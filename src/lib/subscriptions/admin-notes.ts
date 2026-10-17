"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { untypedAdmin } from "@/lib/admin/staff/db";
import {
  actionError,
  actionOk,
  fieldErrorsOf,
  type ActionState,
} from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";

/**
 * Interne Notizen am Abo (Tabelle subscription_notes, Migration 20261017210000). Schreiben und
 * Lesen dürfen Support, Admin und Owner (PERMISSIONS.viewCustomers), Fulfillment nicht, weil
 * Notizen Kundendaten enthalten können. Zugriff nur über die Service-Role; bis die Typen nach der
 * gesammelten Migration neu erzeugt sind, über den ungetypten Client (Muster staff/db.ts).
 * Jede neue Notiz landet im Audit-Log (ohne Text, nur Länge).
 */

export interface SubscriptionNote {
  id: string;
  subscriptionId: string;
  authorId: string | null;
  body: string;
  createdAt: string;
}

interface NoteRow {
  id: string;
  subscription_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

const LIST = "/admin/abos";
const MAX_LENGTH = 5000;

const noteSchema = z.object({
  subscriptionId: z.string().uuid("Ungültiges Abo."),
  body: z
    .string()
    .trim()
    .min(1, "Bitte schreib eine Notiz.")
    .max(MAX_LENGTH, `Höchstens ${MAX_LENGTH} Zeichen.`),
});

/** Notizen eines Abos, neueste zuerst. Ohne Recht (Fulfillment) eine leere Liste. */
export async function listSubscriptionNotes(subscriptionId: string): Promise<SubscriptionNote[]> {
  const session = await requireStaff("support", { next: `${LIST}/${subscriptionId}` });
  if (!PERMISSIONS.viewCustomers(session)) return [];
  if (!z.string().uuid().safeParse(subscriptionId).success) return [];
  const { data, error } = await untypedAdmin()
    .from("subscription_notes")
    .select("id, subscription_id, author_id, body, created_at")
    .eq("subscription_id", subscriptionId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`subscription_notes: ${error.message}`);
  return ((data ?? []) as NoteRow[]).map((r) => ({
    id: r.id,
    subscriptionId: r.subscription_id,
    authorId: r.author_id,
    body: r.body,
    createdAt: r.created_at,
  }));
}

/** Server Action: Notiz anlegen (Formular "Interne Notizen" im Abo-Detail). */
export async function addSubscriptionNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const values = { body: String(formData.get("body") ?? "") };
  const session = await requireStaff("support", { next: `${LIST}/${subscriptionId}` });
  if (!PERMISSIONS.viewCustomers(session)) {
    return actionError("Dafür fehlt dir die Berechtigung.");
  }
  const parsed = noteSchema.safeParse({ subscriptionId, body: values.body });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return actionError(
      fieldErrors.body ?? fieldErrors.subscriptionId ?? "Bitte prüf die Eingabe.",
      {
        fieldErrors,
        values,
      },
    );
  }

  const db = untypedAdmin();
  const { data: sub } = await db
    .from("subscriptions")
    .select("id")
    .eq("id", parsed.data.subscriptionId)
    .maybeSingle();
  if (!sub) return actionError("Abo nicht gefunden.", { values });

  const { data: note, error } = await db
    .from("subscription_notes")
    .insert({
      subscription_id: parsed.data.subscriptionId,
      author_id: session.userId,
      body: parsed.data.body,
    })
    .select("id")
    .single();
  if (error || !note) {
    console.error("[admin] Abo-Notiz", error?.message);
    return actionError("Die Notiz konnte gerade nicht gespeichert werden.", { values });
  }

  await writeAudit(session, {
    action: "subscription.note_add",
    entityType: "subscription",
    entityId: parsed.data.subscriptionId,
    after: { note_id: (note as { id: string }).id, length: parsed.data.body.length },
  });
  await flashToast("Notiz gespeichert");
  revalidatePath(`${LIST}/${parsed.data.subscriptionId}`);
  return actionOk();
}
