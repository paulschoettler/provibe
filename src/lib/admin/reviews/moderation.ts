import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { PermissionError, ValidationError } from "@/lib/admin/customers/guard";
import { safeRevalidate } from "@/lib/admin/content/common";
import { revalidateReviews } from "@/lib/reviews/revalidate";
import { canDeleteReviews, canModerateReviews, reviewsDb } from "./queries";
import { buildRejectionReason, type ReviewStatus } from "./rules";

/**
 * Moderation der Bewertungen: freigeben (einzeln und gesammelt), ablehnen mit Pflichtgrund,
 * Antwort des Shops, Löschen auf Kundenwunsch. Jede Änderung schreibt das Audit-Log und
 * erneuert Tag "reviews" sowie die Produktseite (AggregateRating, Liste der Bewertungen).
 *
 * Fehlen die Spalten aus Migration 20261017208000 noch (vor dem gesammelten Anwenden), läuft
 * die Änderung ohne sie weiter; der Ablehnungsgrund steht dann nur im Audit-Log.
 */

const uuid = z.string().uuid("Ungültige ID");
const NEW_COLUMNS = ["rejection_reason", "reply_at", "reply_by"];

function assertModerate(actor: StaffSession) {
  if (!canModerateReviews(actor)) throw new PermissionError();
}

interface Target {
  id: string;
  status: ReviewStatus;
  rating: number;
  product_id: string;
  handle: string | null;
}

async function loadTargets(ids: string[]): Promise<Target[]> {
  const { data, error } = await reviewsDb()
    .from("reviews")
    .select("id, status, rating, product_id, products(handle)")
    .in("id", ids);
  if (error) throw new Error("Bewertungen laden fehlgeschlagen");
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const p = Array.isArray(r.products) ? r.products[0] : r.products;
    return {
      id: String(r.id),
      status: r.status as ReviewStatus,
      rating: Number(r.rating),
      product_id: String(r.product_id),
      handle: p && typeof p === "object" && "handle" in p ? String(p.handle) : null,
    };
  });
}

/** Storefront erneuern über den Helfer des Bewertungspakets (Tag "reviews", expire 0, Produktseite). */
export function revalidateReviewPages(handles: (string | null)[]): void {
  const unique = [...new Set(handles.filter((x): x is string => Boolean(x)))];
  safeRevalidate(() => {
    if (unique.length === 0) revalidateReviews(null);
    for (const h of unique) revalidateReviews(h);
  });
}

/** Update mit Rückfall, falls neue Spalten in der Datenbank noch fehlen. */
async function updateReviews(ids: string[], patch: Record<string, unknown>): Promise<void> {
  const db = reviewsDb();
  const { error } = await db.from("reviews").update(patch).in("id", ids);
  if (!error) return;
  const missingColumn =
    error.code === "PGRST204" || error.code === "42703" || /column/i.test(error.message);
  if (missingColumn && NEW_COLUMNS.some((c) => c in patch)) {
    const reduced = Object.fromEntries(
      Object.entries(patch).filter(([k]) => !NEW_COLUMNS.includes(k)),
    );
    console.warn("[reviews] Migration 20261017208000 fehlt noch, speichere ohne neue Spalten");
    const retry = await db.from("reviews").update(reduced).in("id", ids);
    if (!retry.error) return;
  }
  console.error("[reviews] Speichern", error.message);
  throw new Error("Bewertung speichern fehlgeschlagen");
}

export async function approveReviews(ids: string[], actor: StaffSession): Promise<number> {
  assertModerate(actor);
  const list = z
    .array(uuid)
    .min(1, "Bitte wähle mindestens eine Bewertung.")
    .max(200)
    .safeParse(ids);
  if (!list.success)
    throw new ValidationError({ ids: list.error.issues[0]?.message ?? "Auswahl prüfen" });
  const targets = (await loadTargets(list.data)).filter((t) => t.status !== "approved");
  if (!targets.length) return 0;
  const now = new Date().toISOString();
  await updateReviews(
    targets.map((t) => t.id),
    {
      status: "approved",
      moderated_by: actor.userId,
      moderated_at: now,
      rejection_reason: null,
      updated_at: now,
    },
  );
  for (const t of targets) {
    await writeAudit(actor, {
      action: "review.approve",
      entityType: "review",
      entityId: t.id,
      before: { status: t.status },
      after: { status: "approved", bulk: targets.length > 1 },
    });
  }
  revalidateReviewPages(targets.map((t) => t.handle));
  return targets.length;
}

export async function rejectReview(
  input: { id: string; reason: string; detail: string },
  actor: StaffSession,
): Promise<void> {
  assertModerate(actor);
  const id = uuid.safeParse(input.id);
  if (!id.success) throw new Error("Bewertung nicht gefunden");
  const reason = buildRejectionReason(input.reason, input.detail);
  if (!reason.ok) throw new ValidationError({ [reason.field]: reason.message });
  const [target] = await loadTargets([id.data]);
  if (!target) throw new Error("Bewertung nicht gefunden");
  const now = new Date().toISOString();
  await updateReviews([target.id], {
    status: "rejected",
    moderated_by: actor.userId,
    moderated_at: now,
    rejection_reason: reason.value,
    updated_at: now,
  });
  await writeAudit(actor, {
    action: "review.reject",
    entityType: "review",
    entityId: target.id,
    before: { status: target.status },
    after: { status: "rejected", reason: reason.value, rating: target.rating },
  });
  revalidateReviewPages([target.handle]);
}

const replySchema = z.string().trim().max(2000, "Höchstens 2000 Zeichen.");

/** Antwort des Shops speichern; leerer Text entfernt die Antwort. */
export async function replyToReview(
  input: { id: string; body: string },
  actor: StaffSession,
): Promise<"saved" | "removed"> {
  assertModerate(actor);
  const id = uuid.safeParse(input.id);
  if (!id.success) throw new Error("Bewertung nicht gefunden");
  const body = replySchema.safeParse(input.body);
  if (!body.success) throw new ValidationError({ replyBody: body.error.issues[0]?.message ?? "" });
  const [target] = await loadTargets([id.data]);
  if (!target) throw new Error("Bewertung nicht gefunden");
  const text = body.data;
  const now = new Date().toISOString();
  await updateReviews([target.id], {
    reply_body: text || null,
    reply_at: text ? now : null,
    reply_by: text ? actor.userId : null,
    updated_at: now,
  });
  await writeAudit(actor, {
    action: text ? "review.reply" : "review.reply_remove",
    entityType: "review",
    entityId: target.id,
    after: { reply_length: text.length },
  });
  revalidateReviewPages([target.handle]);
  return text ? "saved" : "removed";
}

/**
 * Löschen auf Kundenwunsch (DSGVO Art. 17). Das Audit-Log hält nur fest, dass und warum
 * gelöscht wurde, ohne den Bewertungstext und ohne Namen.
 */
export async function deleteReview(
  input: { id: string; note: string },
  actor: StaffSession,
): Promise<void> {
  if (!canDeleteReviews(actor)) throw new PermissionError();
  const id = uuid.safeParse(input.id);
  if (!id.success) throw new Error("Bewertung nicht gefunden");
  const note = input.note.trim().slice(0, 300);
  if (note.length < 5)
    throw new ValidationError({ note: "Bitte notiere kurz den Anlass (zum Beispiel Mail vom …)." });
  const [target] = await loadTargets([id.data]);
  if (!target) return;
  const { error } = await reviewsDb().from("reviews").delete().eq("id", target.id);
  if (error) {
    console.error("[reviews] Löschen", error.message);
    throw new Error("Bewertung löschen fehlgeschlagen");
  }
  await writeAudit(actor, {
    action: "review.delete",
    entityType: "review",
    entityId: target.id,
    before: { status: target.status, rating: target.rating, product_id: target.product_id },
    after: { reason: "Kundenwunsch", note },
  });
  revalidateReviewPages([target.handle]);
}
