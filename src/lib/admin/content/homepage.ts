import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { asJson, crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { assertPermission, parseInput } from "@/lib/admin/customers/guard";
import { linkSchema, revalidateHome } from "./common";

/**
 * Startseiten-Module (homepage_modules): Reihenfolge, Schalter, Konfiguration (Figma 41:2481).
 * Die Konfiguration ist JSON je Modulart; bekannte Felder werden geprüft (Links, Texte),
 * unbekannte bleiben erhalten (passthrough), damit die Storefront neue Felder nutzen kann.
 */

export const HOMEPAGE_MODULE_KINDS = [
  "hero",
  "bestseller",
  "flavors",
  "story",
  "bundles",
  "faq",
  "custom",
] as const;
export const HOMEPAGE_MODULE_LABELS: Record<string, string> = {
  hero: "Hero",
  bestseller: "Bestseller",
  flavors: "Sorten",
  story: "Story",
  bundles: "Bundles",
  faq: "FAQ",
  custom: "Eigener Block",
};

const uuid = z.string().uuid("Ungültige ID");
const text = (max: number) => z.string().trim().max(max);
const cta = z
  .object({ label: text(60), url: linkSchema })
  .partial()
  .optional();
const handle = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Ungültiger Produkt-Handle");

const CONFIG_SCHEMAS: Record<string, z.ZodType> = {
  hero: z
    .object({
      eyebrow: text(80).optional(),
      headline: text(160).optional(),
      text: text(600).optional(),
      badges: z.array(text(40)).max(6).optional(),
      cta,
      image: text(500).optional(),
    })
    .passthrough(),
  bestseller: z
    .object({
      eyebrow: text(80).optional(),
      product_handle: handle.optional(),
      details_label: text(60).optional(),
    })
    .passthrough(),
  flavors: z
    .object({
      eyebrow: text(80).optional(),
      headline: text(160).optional(),
      cta,
      items: z
        .array(
          z
            .object({
              product_handle: handle,
              notes: text(120).optional(),
              image: text(500).optional(),
            })
            .passthrough(),
        )
        .max(12)
        .optional(),
    })
    .passthrough(),
  bundles: z
    .object({
      eyebrow: text(80).optional(),
      headline: text(160).optional(),
      product_handles: z.array(handle).max(12).optional(),
    })
    .passthrough(),
  faq: z
    .object({
      headline: text(160).optional(),
      items: z
        .array(z.object({ question: text(300), answer: text(3000) }))
        .max(30)
        .optional(),
    })
    .passthrough(),
};

/** Konfiguration einer Modulart prüfen; Größe insgesamt höchstens 50 KB. */
export function parseModuleConfig(kind: string, config: unknown): Record<string, unknown> {
  const base = z.record(z.string(), z.unknown()).parse(config ?? {});
  if (JSON.stringify(base).length > 50_000) throw new Error("Die Konfiguration ist zu groß");
  const schema = CONFIG_SCHEMAS[kind];
  return schema ? (parseInput(schema, base) as Record<string, unknown>) : base;
}

export interface HomepageModuleView {
  id: string;
  kind: string;
  label: string;
  position: number;
  isEnabled: boolean;
  config: Record<string, unknown>;
  updatedAt: string;
}

export async function listHomepageModules(locale = "de"): Promise<HomepageModuleView[]> {
  const { data, error } = await crmDb()
    .from("homepage_modules")
    .select("*")
    .eq("locale", locale)
    .order("position");
  if (error) throw dbError("Startseiten-Module laden", error);
  return (data ?? []).map((m) => ({
    id: m.id,
    kind: m.kind,
    label: HOMEPAGE_MODULE_LABELS[m.kind] ?? m.kind,
    position: m.position,
    isEnabled: m.is_enabled,
    config: (m.config && typeof m.config === "object" && !Array.isArray(m.config)
      ? m.config
      : {}) as Record<string, unknown>,
    updatedAt: m.updated_at,
  }));
}

export async function updateHomepageModule(
  input: { id: string; isEnabled?: boolean; config?: Record<string, unknown> },
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "editContent");
  const d = parseInput(
    z.object({
      id: uuid,
      isEnabled: z.boolean().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
    }),
    input,
  );
  const db = crmDb();
  const { data: before } = await db
    .from("homepage_modules")
    .select("*")
    .eq("id", d.id)
    .maybeSingle();
  if (!before) throw new Error("Modul nicht gefunden");
  const patch: { is_enabled?: boolean; config?: ReturnType<typeof asJson> } = {};
  if (d.isEnabled !== undefined) patch.is_enabled = d.isEnabled;
  if (d.config) patch.config = asJson(parseModuleConfig(before.kind, d.config));
  const { error } = await db.from("homepage_modules").update(patch).eq("id", d.id);
  if (error) throw dbError("Modul speichern", error);
  revalidateHome();
  await writeAudit(actor, {
    action: "homepage_module.update",
    entityType: "homepage_module",
    entityId: d.id,
    before: { is_enabled: before.is_enabled, config: d.config ? before.config : undefined },
    after: patch,
  });
}

export async function createHomepageModule(
  input: { kind: string; config?: Record<string, unknown>; locale?: string },
  actor: StaffSession,
): Promise<{ id: string }> {
  assertPermission(actor, "editContent");
  const d = parseInput(
    z.object({
      kind: z.enum(HOMEPAGE_MODULE_KINDS),
      config: z.record(z.string(), z.unknown()).default({}),
      locale: z.enum(["de"]).default("de"),
    }),
    input,
  );
  const db = crmDb();
  const { data: last } = await db
    .from("homepage_modules")
    .select("position")
    .eq("locale", d.locale)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db
    .from("homepage_modules")
    .insert({
      kind: d.kind,
      locale: d.locale,
      position: (last?.position ?? -1) + 1,
      is_enabled: false,
      config: asJson(parseModuleConfig(d.kind, d.config)),
    })
    .select("id")
    .single();
  if (error) throw dbError("Modul anlegen", error);
  await writeAudit(actor, {
    action: "homepage_module.create",
    entityType: "homepage_module",
    entityId: data.id,
    after: { kind: d.kind },
  });
  return { id: data.id };
}

export async function deleteHomepageModule(id: string, actor: StaffSession): Promise<void> {
  assertPermission(actor, "editContent");
  const moduleId = parseInput(uuid, id);
  const db = crmDb();
  const { data: before } = await db
    .from("homepage_modules")
    .select("*")
    .eq("id", moduleId)
    .maybeSingle();
  if (!before) return;
  const { error } = await db.from("homepage_modules").delete().eq("id", moduleId);
  if (error) throw dbError("Modul löschen", error);
  revalidateHome();
  await writeAudit(actor, {
    action: "homepage_module.delete",
    entityType: "homepage_module",
    entityId: moduleId,
    before,
  });
}

/** Neue Reihenfolge: ids in gewünschter Reihenfolge (alle Module der Sprache). */
export async function reorderHomepageModules(
  input: { ids: string[]; locale?: string },
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "editContent");
  const d = parseInput(
    z.object({ ids: z.array(uuid).min(1).max(50), locale: z.enum(["de"]).default("de") }),
    input,
  );
  if (new Set(d.ids).size !== d.ids.length) throw new Error("Doppelte Module in der Reihenfolge");
  const db = crmDb();
  const { data: existing } = await db
    .from("homepage_modules")
    .select("id, position")
    .eq("locale", d.locale);
  const known = new Set((existing ?? []).map((m) => m.id));
  if (d.ids.some((id) => !known.has(id)) || d.ids.length !== known.size)
    throw new Error("Die Reihenfolge muss alle Module genau einmal enthalten");
  for (const [position, id] of d.ids.entries()) {
    const { error } = await db.from("homepage_modules").update({ position }).eq("id", id);
    if (error) throw dbError("Reihenfolge speichern", error);
  }
  revalidateHome();
  await writeAudit(actor, {
    action: "homepage_module.reorder",
    entityType: "homepage_module",
    before: (existing ?? []).sort((a, b) => a.position - b.position).map((m) => m.id),
    after: d.ids,
  });
}
