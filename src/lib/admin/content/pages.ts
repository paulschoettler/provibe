import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { asJson, crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { assertPermission, parseInput } from "@/lib/admin/customers/guard";
import { handleSchema, revalidatePage } from "./common";
import { sanitizeRichHtml } from "./sanitize";

/**
 * Inhaltsseiten (pages, page_translations) mit Entwurf und Veröffentlichen. Rechtstexte liegen
 * getrennt in legal.ts. Ändert sich der URL-Name einer veröffentlichten Seite, entsteht automatisch
 * ein 301-Eintrag in redirects (kein alter Pfad darf verloren gehen).
 */

export const PAGE_TEMPLATES = [
  "default",
  "contact",
  "partner",
  "about",
  "investors",
  "withdrawal",
] as const;
export const PAGE_TEMPLATE_LABELS: Record<(typeof PAGE_TEMPLATES)[number], string> = {
  default: "Standard",
  contact: "Kontakt",
  partner: "Partner (B2B)",
  about: "Über uns",
  investors: "Investoren",
  withdrawal: "Widerruf-Formular",
};

const uuid = z.string().uuid("Ungültige ID");

const pageSchema = z.object({
  handle: handleSchema,
  template: z.enum(PAGE_TEMPLATES).default("default"),
  locale: z.enum(["de"]).default("de"),
  title: z.string().trim().min(1, "Bitte gib einen Titel ein.").max(200),
  bodyHtml: z.string().max(500_000).optional().nullable(),
  blocks: z.array(z.record(z.string(), z.unknown())).max(100).optional(),
  seoTitle: z.string().trim().max(120).optional().nullable(),
  seoDescription: z.string().trim().max(320).optional().nullable(),
  ogImagePath: z.string().trim().max(500).optional().nullable(),
  noindex: z.boolean().default(false),
  showInSitemap: z.boolean().default(true),
  position: z.coerce.number().int().min(0).max(10_000).default(0),
});

export type PageInput = z.input<typeof pageSchema>;

export interface PageListItem {
  id: string;
  handle: string;
  path: string;
  template: string;
  status: "draft" | "published" | "archived";
  title: string;
  noindex: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export async function listPages(): Promise<PageListItem[]> {
  const { data, error } = await crmDb()
    .from("pages")
    .select(
      "id, handle, template, status, noindex, published_at, updated_at, position, page_translations(title, locale)",
    )
    .order("position")
    .order("handle");
  if (error) throw dbError("Seiten laden", error);
  return (data ?? []).map((p) => ({
    id: p.id,
    handle: p.handle,
    path: `/pages/${p.handle}`,
    template: p.template,
    status: p.status,
    title: p.page_translations?.find((t) => t.locale === "de")?.title ?? p.handle,
    noindex: p.noindex,
    publishedAt: p.published_at,
    updatedAt: p.updated_at,
  }));
}

export async function getPage(id: string, locale = "de") {
  const pageId = parseInput(uuid, id);
  const db = crmDb();
  const { data: page, error } = await db.from("pages").select("*").eq("id", pageId).maybeSingle();
  if (error) throw dbError("Seite laden", error);
  if (!page) return null;
  const { data: t } = await db
    .from("page_translations")
    .select("*")
    .eq("page_id", page.id)
    .eq("locale", locale)
    .maybeSingle();
  return {
    id: page.id,
    handle: page.handle,
    path: `/pages/${page.handle}`,
    template: page.template,
    status: page.status,
    noindex: page.noindex,
    showInSitemap: page.show_in_sitemap,
    position: page.position,
    publishedAt: page.published_at,
    updatedAt: page.updated_at,
    locale,
    title: t?.title ?? "",
    bodyHtml: t?.body_html ?? "",
    blocks: t?.blocks ?? [],
    seoTitle: t?.seo_title ?? null,
    seoDescription: t?.seo_description ?? null,
    ogImagePath: t?.og_image_path ?? null,
  };
}

function translationRow(pageId: string, d: z.infer<typeof pageSchema>) {
  return {
    page_id: pageId,
    locale: d.locale,
    title: d.title,
    body_html: d.bodyHtml ? sanitizeRichHtml(d.bodyHtml) : null,
    blocks: asJson(d.blocks ?? []),
    seo_title: d.seoTitle || null,
    seo_description: d.seoDescription || null,
    og_image_path: d.ogImagePath || null,
  };
}

async function assertHandleFree(handle: string, exceptId?: string) {
  const { data } = await crmDb().from("pages").select("id").eq("handle", handle).maybeSingle();
  if (data && data.id !== exceptId) throw new Error(`Der URL-Name „${handle}“ ist schon vergeben`);
}

/** Neue Seite als Entwurf. */
export async function createPage(input: PageInput, actor: StaffSession): Promise<{ id: string }> {
  assertPermission(actor, "editContent");
  const d = parseInput(pageSchema, input);
  await assertHandleFree(d.handle);
  const db = crmDb();
  const { data: page, error } = await db
    .from("pages")
    .insert({
      handle: d.handle,
      template: d.template,
      status: "draft",
      noindex: d.noindex,
      show_in_sitemap: d.showInSitemap,
      position: d.position,
    })
    .select("id")
    .single();
  if (error) throw dbError("Seite anlegen", error);
  const { error: tErr } = await db.from("page_translations").insert(translationRow(page.id, d));
  if (tErr) throw dbError("Seitentext speichern", tErr);
  await writeAudit(actor, {
    action: "page.create",
    entityType: "page",
    entityId: page.id,
    after: { handle: d.handle, title: d.title },
  });
  return { id: page.id };
}

export async function updatePage(id: string, input: PageInput, actor: StaffSession): Promise<void> {
  assertPermission(actor, "editContent");
  const pageId = parseInput(uuid, id);
  const d = parseInput(pageSchema, input);
  const db = crmDb();
  const { data: before } = await db.from("pages").select("*").eq("id", pageId).maybeSingle();
  if (!before) throw new Error("Seite nicht gefunden");
  if (d.handle !== before.handle) await assertHandleFree(d.handle, pageId);
  const { error } = await db
    .from("pages")
    .update({
      handle: d.handle,
      template: d.template,
      noindex: d.noindex,
      show_in_sitemap: d.showInSitemap,
      position: d.position,
    })
    .eq("id", pageId);
  if (error) throw dbError("Seite speichern", error);
  const { error: tErr } = await db
    .from("page_translations")
    .upsert(translationRow(pageId, d), { onConflict: "page_id,locale" });
  if (tErr) throw dbError("Seitentext speichern", tErr);

  if (d.handle !== before.handle && before.status === "published") {
    // Alter Pfad leitet dauerhaft auf den neuen (redirects-Tabelle, von der Storefront auszuwerten)
    await db.from("redirects").upsert(
      {
        from_path: `/pages/${before.handle}`,
        to_path: `/pages/${d.handle}`,
        status_code: 301,
        is_enabled: true,
        note: `Automatisch beim Umbenennen durch ${actor.email}`,
      },
      { onConflict: "from_path" },
    );
    revalidatePage(before.handle);
  }
  if (before.status === "published") revalidatePage(d.handle);
  await writeAudit(actor, {
    action: "page.update",
    entityType: "page",
    entityId: pageId,
    before: { handle: before.handle, template: before.template, noindex: before.noindex },
    after: { handle: d.handle, template: d.template, noindex: d.noindex, title: d.title },
  });
}

async function setStatus(
  id: string,
  status: "draft" | "published" | "archived",
  actor: StaffSession,
) {
  assertPermission(actor, "editContent");
  const pageId = parseInput(uuid, id);
  const db = crmDb();
  const { data: before } = await db
    .from("pages")
    .select("id, handle, status, published_at")
    .eq("id", pageId)
    .maybeSingle();
  if (!before) throw new Error("Seite nicht gefunden");
  if (status === "published") {
    const { data: t } = await db
      .from("page_translations")
      .select("title")
      .eq("page_id", pageId)
      .eq("locale", "de")
      .maybeSingle();
    if (!t?.title) throw new Error("Die Seite braucht einen Titel, bevor sie veröffentlicht wird");
  }
  const { error } = await db
    .from("pages")
    .update({
      status,
      published_at:
        status === "published"
          ? (before.published_at ?? new Date().toISOString())
          : before.published_at,
    })
    .eq("id", pageId);
  if (error) throw dbError("Status speichern", error);
  revalidatePage(before.handle);
  await writeAudit(actor, {
    action: `page.${status === "published" ? "publish" : status === "draft" ? "unpublish" : "archive"}`,
    entityType: "page",
    entityId: pageId,
    before: { status: before.status },
    after: { status },
  });
}

export const publishPage = (id: string, actor: StaffSession) => setStatus(id, "published", actor);
export const unpublishPage = (id: string, actor: StaffSession) => setStatus(id, "draft", actor);
export const archivePage = (id: string, actor: StaffSession) => setStatus(id, "archived", actor);
