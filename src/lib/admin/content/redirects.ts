import "server-only";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { crmDb, dbError, UNIQUE_VIOLATION } from "@/lib/admin/customers/crm-db";
import { assertPermission, parseInput, ValidationError } from "@/lib/admin/customers/guard";
import { safeRevalidate } from "./common";
import { checkRedirect, normalizeRedirectPath, type RedirectLike } from "./redirect-rules";

/**
 * Weiterleitungen (public.redirects) im Backoffice: Liste, anlegen mit Prüfung auf doppelte
 * Quellen und Schleifen, bearbeiten, aktiv/inaktiv, löschen. Die Storefront wertet aktive Zeilen
 * im Proxy vor dem Routing aus (src/lib/redirects/proxy.ts) und hält sie je Server-Instanz bis zu
 * fünf Minuten im Speicher; revalidateTag("redirects") erneuert zusätzlich gecachte Lesewege.
 */

export const REDIRECTS_TAG = "redirects";
const PAGE_SIZE = 50;
const uuid = z.string().uuid("Ungültige ID");

export interface RedirectView {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  isEnabled: boolean;
  hits: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: string;
  from_path: string;
  to_path: string;
  status_code: number;
  is_enabled: boolean;
  hits: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

function toView(r: Row): RedirectView {
  return {
    id: r.id,
    fromPath: r.from_path,
    toPath: r.to_path,
    statusCode: r.status_code,
    isEnabled: r.is_enabled,
    hits: Number(r.hits ?? 0),
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function revalidateRedirects(): void {
  safeRevalidate(() => revalidateTag(REDIRECTS_TAG, { expire: 0 }));
}

export async function listRedirects(input: {
  q?: string;
  status?: "aktiv" | "inaktiv";
  page?: number;
}): Promise<{
  rows: RedirectView[];
  total: number;
  pageSize: number;
  counts: Record<string, number>;
}> {
  const db = crmDb();
  const page = Math.max(1, input.page ?? 1);
  let query = db
    .from("redirects")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (input.status) query = query.eq("is_enabled", input.status === "aktiv");
  const q = input.q?.trim().replace(/[%,()]/g, "");
  if (q) query = query.or(`from_path.ilike.%${q}%,to_path.ilike.%${q}%,note.ilike.%${q}%`);
  const [{ data, count, error }, all, active] = await Promise.all([
    query,
    db.from("redirects").select("id", { count: "exact", head: true }),
    db.from("redirects").select("id", { count: "exact", head: true }).eq("is_enabled", true),
  ]);
  if (error) throw dbError("Weiterleitungen laden", error);
  const total = all.count ?? 0;
  const activeCount = active.count ?? 0;
  return {
    rows: ((data ?? []) as Row[]).map(toView),
    total: count ?? 0,
    pageSize: PAGE_SIZE,
    counts: { alle: total, aktiv: activeCount, inaktiv: total - activeCount },
  };
}

export async function getRedirect(id: string): Promise<RedirectView | null> {
  const { data, error } = await crmDb()
    .from("redirects")
    .select("*")
    .eq("id", parseInput(uuid, id))
    .maybeSingle();
  if (error) throw dbError("Weiterleitung laden", error);
  return data ? toView(data as Row) : null;
}

async function allRedirects(): Promise<RedirectLike[]> {
  const { data, error } = await crmDb()
    .from("redirects")
    .select("id, from_path, to_path, is_enabled")
    .limit(5000);
  if (error) throw dbError("Weiterleitungen laden", error);
  return (data ?? []).map((r) => ({
    id: r.id,
    fromPath: r.from_path,
    toPath: r.to_path,
    isEnabled: r.is_enabled,
  }));
}

const redirectSchema = z.object({
  fromPath: z.string().trim().min(1, "Bitte gib den alten Pfad ein.").max(500),
  toPath: z.string().trim().min(1, "Bitte gib das Ziel ein.").max(1000),
  statusCode: z.coerce
    .number()
    .int()
    .refine((v) => [301, 302, 307, 308].includes(v), "Ungültiger Statuscode.")
    .default(301),
  isEnabled: z.boolean().default(true),
  note: z.string().trim().max(300).optional().nullable(),
});

export type RedirectInput = z.input<typeof redirectSchema>;

async function validated(input: RedirectInput, id?: string) {
  const d = parseInput(redirectSchema, input);
  const check = checkRedirect(
    { id, fromPath: d.fromPath, toPath: d.toPath, isEnabled: d.isEnabled },
    await allRedirects(),
  );
  if (!check.ok) throw new ValidationError({ [check.field]: check.message });
  const shadowed = d.isEnabled ? await liveRouteAt(check.fromPath) : null;
  const warnings = shadowed
    ? [
        `Unter ${check.fromPath} gibt es ${shadowed}. Die Weiterleitung greift vor dem Routing, die Seite ist dann nicht mehr erreichbar.`,
        ...check.warnings,
      ]
    : check.warnings;
  return { ...d, fromPath: check.fromPath, toPath: check.toPath, warnings };
}

/**
 * Lebt unter dem Pfad noch eine Seite? Die Storefront wertet die Tabelle im Proxy aus
 * (src/lib/redirects/proxy.ts), also vor dem Routing: eine aktive Weiterleitung verdeckt sie.
 */
async function liveRouteAt(path: string): Promise<string | null> {
  const m = /^\/(pages|products|collections)\/([a-z0-9-]+)$/.exec(path);
  if (!m) return null;
  const db = crmDb();
  if (m[1] === "pages") {
    const { data } = await db
      .from("pages")
      .select("id")
      .eq("handle", m[2])
      .eq("status", "published")
      .maybeSingle();
    if (data) return "eine veröffentlichte Seite";
    if (
      [
        "impressum",
        "allgemeine-geschaftsbedingungen",
        "ruckgabe-und-wiederrufsbelehrung",
        "versand",
        "widerruf-formular",
        "shop",
      ].includes(m[2])
    )
      return "eine Seite mit eigener Route";
    return null;
  }
  if (m[1] === "products") {
    const { data } = await db
      .from("products")
      .select("id")
      .eq("handle", m[2])
      .eq("status", "active")
      .maybeSingle();
    return data ? "ein aktives Produkt" : null;
  }
  const { data } = await db
    .from("collections")
    .select("id")
    .eq("handle", m[2])
    .eq("status", "published")
    .maybeSingle();
  return data ? "eine veröffentlichte Kollektion" : null;
}

export async function createRedirect(
  input: RedirectInput,
  actor: StaffSession,
): Promise<{ id: string; warnings: string[] }> {
  assertPermission(actor, "editContent");
  const d = await validated(input);
  const row = {
    from_path: d.fromPath,
    to_path: d.toPath,
    status_code: d.statusCode,
    is_enabled: d.isEnabled,
    note: d.note || null,
  };
  const { data, error } = await crmDb().from("redirects").insert(row).select("id").single();
  if (error?.code === UNIQUE_VIOLATION)
    throw new ValidationError({ fromPath: "Für diese Quelle gibt es schon eine Weiterleitung." });
  if (error) throw dbError("Weiterleitung anlegen", error);
  revalidateRedirects();
  await writeAudit(actor, {
    action: "redirect.create",
    entityType: "redirect",
    entityId: data.id,
    after: row,
  });
  return { id: data.id, warnings: d.warnings };
}

export async function updateRedirect(
  id: string,
  input: RedirectInput,
  actor: StaffSession,
): Promise<{ warnings: string[] }> {
  assertPermission(actor, "editContent");
  const redirectId = parseInput(uuid, id);
  const db = crmDb();
  const { data: before } = await db
    .from("redirects")
    .select("*")
    .eq("id", redirectId)
    .maybeSingle();
  if (!before) throw new Error("Weiterleitung nicht gefunden");
  const d = await validated(input, redirectId);
  const row = {
    from_path: d.fromPath,
    to_path: d.toPath,
    status_code: d.statusCode,
    is_enabled: d.isEnabled,
    note: d.note || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("redirects").update(row).eq("id", redirectId);
  if (error?.code === UNIQUE_VIOLATION)
    throw new ValidationError({ fromPath: "Für diese Quelle gibt es schon eine Weiterleitung." });
  if (error) throw dbError("Weiterleitung speichern", error);
  revalidateRedirects();
  await writeAudit(actor, {
    action: "redirect.update",
    entityType: "redirect",
    entityId: redirectId,
    before: {
      from_path: before.from_path,
      to_path: before.to_path,
      status_code: before.status_code,
      is_enabled: before.is_enabled,
    },
    after: row,
  });
  return { warnings: d.warnings };
}

/** Aktiv/inaktiv schalten; beim Einschalten erneut auf Schleifen prüfen. */
export async function setRedirectEnabled(
  id: string,
  enabled: boolean,
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "editContent");
  const redirectId = parseInput(uuid, id);
  const db = crmDb();
  const { data: before } = await db
    .from("redirects")
    .select("*")
    .eq("id", redirectId)
    .maybeSingle();
  if (!before) throw new Error("Weiterleitung nicht gefunden");
  if (enabled) {
    const check = checkRedirect(
      { id: redirectId, fromPath: before.from_path, toPath: before.to_path, isEnabled: true },
      await allRedirects(),
    );
    if (!check.ok) throw new Error(check.message);
  }
  const { error } = await db
    .from("redirects")
    .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("id", redirectId);
  if (error) throw dbError("Weiterleitung schalten", error);
  revalidateRedirects();
  await writeAudit(actor, {
    action: enabled ? "redirect.enable" : "redirect.disable",
    entityType: "redirect",
    entityId: redirectId,
    before: { is_enabled: before.is_enabled },
    after: { is_enabled: enabled },
  });
}

export async function deleteRedirect(id: string, actor: StaffSession): Promise<void> {
  assertPermission(actor, "editContent");
  const redirectId = parseInput(uuid, id);
  const db = crmDb();
  const { data: before } = await db
    .from("redirects")
    .select("*")
    .eq("id", redirectId)
    .maybeSingle();
  if (!before) return;
  const { error } = await db.from("redirects").delete().eq("id", redirectId);
  if (error) throw dbError("Weiterleitung löschen", error);
  revalidateRedirects();
  await writeAudit(actor, {
    action: "redirect.delete",
    entityType: "redirect",
    entityId: redirectId,
    before: {
      from_path: before.from_path,
      to_path: before.to_path,
      status_code: before.status_code,
    },
  });
}

/**
 * Wird eine Seite unter einem Pfad veröffentlicht oder umbenannt, darf keine aktive
 * Weiterleitung mehr von genau diesem Pfad wegführen (sonst Schleife oder tote Seite).
 * Deaktiviert solche Zeilen und gibt ihre Anzahl zurück.
 */
export async function disableRedirectsFrom(path: string, actor: StaffSession): Promise<number> {
  const target = normalizeRedirectPath(path);
  const { data } = await crmDb()
    .from("redirects")
    .select("id, from_path, is_enabled")
    .eq("is_enabled", true);
  const hits = (data ?? []).filter((r) => normalizeRedirectPath(r.from_path) === target);
  for (const r of hits) {
    await crmDb()
      .from("redirects")
      .update({ is_enabled: false, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    await writeAudit(actor, {
      action: "redirect.disable",
      entityType: "redirect",
      entityId: r.id,
      before: { is_enabled: true },
      after: { is_enabled: false, reason: `Pfad ${target} ist wieder eine Seite` },
    });
  }
  if (hits.length) revalidateRedirects();
  return hits.length;
}
