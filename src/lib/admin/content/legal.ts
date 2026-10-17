import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { assertPermission, parseInput } from "@/lib/admin/customers/guard";
import { LEGAL_PATHS, type LegalKind } from "@/lib/content/legal";
import { revalidateLegalKind } from "./common";
import { diffParagraphs, type DiffResult } from "./diff";
import { currentVersionOf } from "./versions";
import { sanitizeRichHtml, textLength } from "./sanitize";

/**
 * Rechtstexte mit Versionen (legal_documents, legal_document_versions):
 *   - neue Version immer als Entwurf (Kopie der gültigen Fassung), Änderungsvermerk Pflicht
 *   - Veröffentlichen setzt published_at und effective_from, alte Versionen bleiben unverändert
 *     (Trigger legal_versions_immutable, Nachweis welche Fassung bei einer Bestellung galt)
 *   - Vergleich alt gegen neu auf Absatzebene (diff.ts)
 * Nur Owner und Admin (editContent).
 */

export const LEGAL_KINDS = ["impressum", "agb", "widerruf", "datenschutz", "versand"] as const;
export const LEGAL_KIND_LABELS: Record<LegalKind, string> = {
  impressum: "Impressum",
  agb: "AGB",
  widerruf: "Widerrufsbelehrung",
  datenschutz: "Datenschutzerklärung",
  versand: "Versand und Zahlung",
};

const uuid = z.string().uuid("Ungültige ID");

export interface LegalVersionSummary {
  id: string;
  version: number;
  locale: string;
  title: string;
  status: "draft" | "published" | "archived";
  changeNote: string | null;
  effectiveFrom: string | null;
  publishedAt: string | null;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
  /** aktuell gültige Fassung */
  isCurrent: boolean;
}

export interface LegalDocumentOverview {
  id: string;
  kind: LegalKind;
  label: string;
  path: string;
  current: LegalVersionSummary | null;
  draft: LegalVersionSummary | null;
  /** veröffentlicht, aber effective_from in der Zukunft */
  upcoming: LegalVersionSummary | null;
  versionsCount: number;
}

type VersionRow = {
  id: string;
  document_id: string;
  version: number;
  locale: string;
  title: string;
  status: "draft" | "published" | "archived";
  change_note: string | null;
  effective_from: string | null;
  published_at: string | null;
  created_at: string;
  created_by: string | null;
};

async function staffNames(ids: (string | null)[]) {
  const unique = Array.from(new Set(ids.filter((x): x is string => Boolean(x))));
  if (!unique.length) return new Map<string, string>();
  const { data } = await crmDb()
    .from("staff_users")
    .select("user_id, display_name, email")
    .in("user_id", unique);
  return new Map((data ?? []).map((s) => [s.user_id, s.display_name ?? s.email]));
}

function summarize(
  v: VersionRow,
  currentId: string | null,
  names: Map<string, string>,
): LegalVersionSummary {
  return {
    id: v.id,
    version: v.version,
    locale: v.locale,
    title: v.title,
    status: v.status,
    changeNote: v.change_note,
    effectiveFrom: v.effective_from,
    publishedAt: v.published_at,
    createdAt: v.created_at,
    createdBy: v.created_by,
    createdByName: v.created_by ? (names.get(v.created_by) ?? null) : null,
    isCurrent: v.id === currentId,
  };
}

const VERSION_COLUMNS =
  "id, document_id, version, locale, title, status, change_note, effective_from, published_at, created_at, created_by";

export async function listLegalDocuments(locale = "de"): Promise<LegalDocumentOverview[]> {
  const db = crmDb();
  const [{ data: docs, error }, { data: versions, error: vErr }] = await Promise.all([
    db.from("legal_documents").select("id, kind, path"),
    db.from("legal_document_versions").select(VERSION_COLUMNS).eq("locale", locale),
  ]);
  if (error || vErr) throw dbError("Rechtstexte laden", error ?? vErr);
  const names = await staffNames((versions ?? []).map((v) => v.created_by));
  const now = new Date();
  return LEGAL_KINDS.map((kind) => {
    const doc = (docs ?? []).find((d) => d.kind === kind);
    const own = (versions ?? []).filter((v) => v.document_id === doc?.id);
    const current = currentVersionOf(own, now);
    const draft =
      own.filter((v) => v.status === "draft").sort((a, b) => b.version - a.version)[0] ?? null;
    const upcoming =
      own
        .filter(
          (v) => v.status === "published" && v.effective_from && new Date(v.effective_from) > now,
        )
        .sort((a, b) => a.version - b.version)[0] ?? null;
    return {
      id: doc?.id ?? "",
      kind,
      label: LEGAL_KIND_LABELS[kind],
      path: doc?.path ?? LEGAL_PATHS[kind],
      current: current ? summarize(current, current.id, names) : null,
      draft: draft ? summarize(draft, current?.id ?? null, names) : null,
      upcoming: upcoming ? summarize(upcoming, current?.id ?? null, names) : null,
      versionsCount: own.length,
    };
  });
}

async function documentByKind(kind: LegalKind) {
  const { data, error } = await crmDb()
    .from("legal_documents")
    .select("id, kind, path")
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw dbError("Rechtstext laden", error);
  if (!data) throw new Error("Rechtstext nicht gefunden");
  return data;
}

export async function listLegalVersions(
  kind: LegalKind,
  locale = "de",
): Promise<LegalVersionSummary[]> {
  const k = parseInput(z.enum(LEGAL_KINDS), kind);
  const doc = await documentByKind(k);
  const { data, error } = await crmDb()
    .from("legal_document_versions")
    .select(VERSION_COLUMNS)
    .eq("document_id", doc.id)
    .eq("locale", locale)
    .order("version", { ascending: false });
  if (error) throw dbError("Versionen laden", error);
  const current = currentVersionOf(data ?? []);
  const names = await staffNames((data ?? []).map((v) => v.created_by));
  return (data ?? []).map((v) => summarize(v, current?.id ?? null, names));
}

export async function getLegalVersion(id: string) {
  const versionId = parseInput(uuid, id);
  const { data, error } = await crmDb()
    .from("legal_document_versions")
    .select("*, legal_documents(kind, path)")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw dbError("Version laden", error);
  if (!data) return null;
  return {
    id: data.id,
    kind: data.legal_documents?.kind ?? null,
    path: data.legal_documents?.path ?? null,
    version: data.version,
    locale: data.locale,
    title: data.title,
    bodyHtml: data.body_html,
    changeNote: data.change_note,
    status: data.status,
    effectiveFrom: data.effective_from,
    publishedAt: data.published_at,
    createdAt: data.created_at,
    editable: data.status === "draft",
  };
}

const draftSchema = z.object({
  kind: z.enum(LEGAL_KINDS),
  locale: z.enum(["de"]).default("de"),
  basedOnVersionId: uuid.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  bodyHtml: z.string().max(1_000_000).optional(),
  changeNote: z.string().trim().max(1000).optional(),
});

/** Neue Version als Entwurf, standardmäßig als Kopie der gültigen Fassung. Pro Text höchstens ein Entwurf. */
export async function createLegalDraft(
  input: z.input<typeof draftSchema>,
  actor: StaffSession,
): Promise<{ id: string; version: number }> {
  assertPermission(actor, "editContent");
  const d = parseInput(draftSchema, input);
  const doc = await documentByKind(d.kind);
  const db = crmDb();
  const { data: versions, error } = await db
    .from("legal_document_versions")
    .select("id, version, status, effective_from, title, body_html")
    .eq("document_id", doc.id)
    .eq("locale", d.locale);
  if (error) throw dbError("Versionen laden", error);
  const existingDraft = (versions ?? []).find((v) => v.status === "draft");
  if (existingDraft)
    throw new Error(`Es gibt schon einen Entwurf (Version ${existingDraft.version})`);
  const base = d.basedOnVersionId
    ? (versions ?? []).find((v) => v.id === d.basedOnVersionId)
    : currentVersionOf(versions ?? []);
  const version = Math.max(0, ...(versions ?? []).map((v) => v.version)) + 1;
  const { data: row, error: insErr } = await db
    .from("legal_document_versions")
    .insert({
      document_id: doc.id,
      locale: d.locale,
      version,
      title: d.title ?? base?.title ?? LEGAL_KIND_LABELS[d.kind],
      body_html: sanitizeRichHtml(d.bodyHtml ?? base?.body_html ?? ""),
      change_note: d.changeNote ?? null,
      status: "draft",
      created_by: actor.userId,
    })
    .select("id")
    .single();
  if (insErr) throw dbError("Entwurf anlegen", insErr);
  await writeAudit(actor, {
    action: "legal.draft_create",
    entityType: "legal_document_version",
    entityId: row.id,
    after: { kind: d.kind, version, based_on: base?.version ?? null },
  });
  return { id: row.id, version };
}

const updateDraftSchema = z.object({
  title: z.string().trim().min(1, "Bitte gib einen Titel ein.").max(200),
  bodyHtml: z.string().max(1_000_000),
  changeNote: z.string().trim().max(1000).optional().nullable(),
});

export async function updateLegalDraft(
  versionId: string,
  input: z.input<typeof updateDraftSchema>,
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "editContent");
  const id = parseInput(uuid, versionId);
  const d = parseInput(updateDraftSchema, input);
  const db = crmDb();
  const { data: before } = await db
    .from("legal_document_versions")
    .select("id, status, title, change_note")
    .eq("id", id)
    .maybeSingle();
  if (!before) throw new Error("Version nicht gefunden");
  if (before.status !== "draft")
    throw new Error("Nur Entwürfe lassen sich bearbeiten, lege eine neue Version an");
  const { error } = await db
    .from("legal_document_versions")
    .update({
      title: d.title,
      body_html: sanitizeRichHtml(d.bodyHtml),
      change_note: d.changeNote ?? null,
    })
    .eq("id", id)
    .eq("status", "draft");
  if (error) throw dbError("Entwurf speichern", error);
  await writeAudit(actor, {
    action: "legal.draft_update",
    entityType: "legal_document_version",
    entityId: id,
    before: { title: before.title, change_note: before.change_note },
    after: { title: d.title, change_note: d.changeNote ?? null },
  });
}

export async function deleteLegalDraft(versionId: string, actor: StaffSession): Promise<void> {
  assertPermission(actor, "editContent");
  const id = parseInput(uuid, versionId);
  const db = crmDb();
  const { data: before } = await db
    .from("legal_document_versions")
    .select("id, status, version, document_id")
    .eq("id", id)
    .maybeSingle();
  if (!before) return;
  if (before.status !== "draft")
    throw new Error("Veröffentlichte Versionen bleiben als Nachweis erhalten");
  const { error } = await db
    .from("legal_document_versions")
    .delete()
    .eq("id", id)
    .eq("status", "draft");
  if (error) throw dbError("Entwurf löschen", error);
  await writeAudit(actor, {
    action: "legal.draft_delete",
    entityType: "legal_document_version",
    entityId: id,
    before,
  });
}

const publishSchema = z.object({
  versionId: uuid,
  /** Gültig ab; leer = sofort. Zukünftige Daten sind erlaubt (Ankündigung von AGB-Änderungen). */
  effectiveFrom: z.string().datetime({ offset: true }).optional().nullable(),
});

export async function publishLegalVersion(
  input: z.input<typeof publishSchema>,
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "editContent");
  const d = parseInput(publishSchema, input);
  const db = crmDb();
  const { data: v } = await db
    .from("legal_document_versions")
    .select(
      "id, status, version, change_note, body_html, title, document_id, legal_documents(kind)",
    )
    .eq("id", d.versionId)
    .maybeSingle();
  if (!v) throw new Error("Version nicht gefunden");
  if (v.status !== "draft") throw new Error("Diese Version ist schon veröffentlicht");
  if (!v.change_note?.trim()) throw new Error("Bitte trag einen Änderungsvermerk ein");
  if (textLength(v.body_html) < 50) throw new Error("Der Text ist zu kurz für einen Rechtstext");
  const now = new Date();
  const effectiveFrom = d.effectiveFrom ? new Date(d.effectiveFrom) : now;
  if (effectiveFrom.getTime() < now.getTime() - 5 * 60_000)
    throw new Error("Gültig ab darf nicht in der Vergangenheit liegen");
  const { error } = await db
    .from("legal_document_versions")
    .update({
      status: "published",
      published_at: now.toISOString(),
      published_by: actor.userId,
      effective_from: effectiveFrom.toISOString(),
    })
    .eq("id", v.id)
    .eq("status", "draft");
  if (error) throw dbError("Veröffentlichen", error);
  await db
    .from("legal_documents")
    .update({ updated_at: now.toISOString() })
    .eq("id", v.document_id);
  const kind = v.legal_documents?.kind as LegalKind | undefined;
  if (kind) revalidateLegalKind(kind);
  await writeAudit(actor, {
    action: "legal.publish",
    entityType: "legal_document_version",
    entityId: v.id,
    after: {
      kind,
      version: v.version,
      effective_from: effectiveFrom.toISOString(),
      change_note: v.change_note,
    },
  });
}

/**
 * Zwei Versionen vergleichen (alt gegen neu). Ohne oldVersionId: gegen die aktuell gültige Fassung
 * desselben Rechtstexts.
 */
export async function compareLegalVersions(input: {
  newVersionId: string;
  oldVersionId?: string;
}): Promise<{
  old: { id: string; version: number; title: string } | null;
  new: { id: string; version: number; title: string };
  diff: DiffResult;
}> {
  const d = parseInput(z.object({ newVersionId: uuid, oldVersionId: uuid.optional() }), input);
  const db = crmDb();
  const { data: next } = await db
    .from("legal_document_versions")
    .select("id, version, title, body_html, document_id, locale")
    .eq("id", d.newVersionId)
    .maybeSingle();
  if (!next) throw new Error("Version nicht gefunden");
  let old: { id: string; version: number; title: string; body_html: string } | null = null;
  if (d.oldVersionId) {
    const { data } = await db
      .from("legal_document_versions")
      .select("id, version, title, body_html")
      .eq("id", d.oldVersionId)
      .maybeSingle();
    old = data ?? null;
  } else {
    const { data } = await db
      .from("legal_document_versions")
      .select("id, version, title, body_html, status, effective_from")
      .eq("document_id", next.document_id)
      .eq("locale", next.locale)
      .neq("id", next.id);
    old = currentVersionOf(data ?? []);
  }
  return {
    old: old ? { id: old.id, version: old.version, title: old.title } : null,
    new: { id: next.id, version: next.version, title: next.title },
    diff: diffParagraphs(old?.body_html ?? "", next.body_html),
  };
}
