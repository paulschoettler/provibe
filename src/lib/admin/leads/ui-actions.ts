"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, type ActionState } from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import { runCrmAction, str } from "@/lib/admin/customers/crm-action";
import {
  CONTACT_STATUSES,
  CONTACT_STATUS_LABELS,
  WITHDRAWAL_STATUSES,
  WITHDRAWAL_STATUS_LABELS,
  setContactMessageStatus,
  setWithdrawalStatus,
  type ContactStatus,
  type WithdrawalStatus,
} from "./inbox";
import { addLeadNote, assignLead, convertLeadToB2B, setLeadStatus } from "./leads";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from "./status";

/**
 * Server Actions für Leads, Kontaktanfragen und Widerrufe. Support darf alles außer der
 * Umwandlung in einen B2B-Kunden (Owner und Admin).
 */

const PATH = "/admin/leads";
const uuid = z.string().uuid();

function ids(formData: FormData): string[] {
  return [...new Set(formData.getAll("ids").map(String))].filter((v) => uuid.safeParse(v).success);
}

function leadPath(id: string) {
  return uuid.safeParse(id).success ? `${PATH}/${id}` : PATH;
}

export async function setLeadStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = str(formData, "leadId");
  return runCrmAction("viewCustomers", leadPath(id), async (session) => {
    const status = str(formData, "status") as LeadStatus;
    if (!(LEAD_STATUSES as readonly string[]).includes(status))
      return actionError("Bitte wähle einen Status.");
    await setLeadStatus({ leadId: id, status }, session);
    await flashToast(`Status: ${LEAD_STATUS_LABELS[status]}`);
    revalidatePath(leadPath(id));
    revalidatePath(PATH);
  });
}

export async function bulkLeadStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runCrmAction("viewCustomers", PATH, async (session) => {
    const selected = ids(formData);
    const status = str(formData, "status") as LeadStatus;
    if (selected.length === 0) return actionError("Bitte wähle mindestens einen Lead.");
    if (!(LEAD_STATUSES as readonly string[]).includes(status))
      return actionError("Bitte wähle einen Status.");
    let changed = 0;
    const skipped: string[] = [];
    for (const leadId of selected) {
      try {
        await setLeadStatus({ leadId, status }, session);
        changed++;
      } catch (error) {
        skipped.push(error instanceof Error ? error.message : "Fehler");
      }
    }
    await flashToast(
      `${changed} ${changed === 1 ? "Lead" : "Leads"} auf „${LEAD_STATUS_LABELS[status]}“${skipped.length ? `, ${skipped.length} übersprungen (Wechsel nicht erlaubt oder schon gesetzt)` : ""}`,
      changed > 0 ? "success" : "error",
    );
    revalidatePath(PATH);
  });
}

export async function addLeadNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = str(formData, "leadId");
  const body = String(formData.get("body") ?? "");
  return runCrmAction(
    "viewCustomers",
    leadPath(id),
    async (session) => {
      await addLeadNote({ leadId: id, body }, session);
      await flashToast("Notiz gespeichert");
      revalidatePath(leadPath(id));
    },
    { body },
  );
}

export async function assignLeadAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = str(formData, "leadId");
  return runCrmAction("viewCustomers", leadPath(id), async (session) => {
    const userId = str(formData, "userId");
    await assignLead({ leadId: id, userId: userId || null }, session);
    await flashToast(userId ? "Lead zugewiesen" : "Zuweisung aufgehoben");
    revalidatePath(leadPath(id));
    revalidatePath(PATH);
  });
}

export async function convertLeadAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = str(formData, "leadId");
  const values = { companyName: str(formData, "companyName"), vatId: str(formData, "vatId") };
  return runCrmAction(
    "ownerOrAdmin",
    leadPath(id),
    async (session) => {
      const result = await convertLeadToB2B(
        {
          leadId: id,
          companyName: values.companyName || undefined,
          vatId: values.vatId || undefined,
        },
        session,
      );
      await flashToast(
        result.created
          ? "B2B-Kunde angelegt, Lead gewonnen"
          : "Bestehender Kunde als B2B freigeschaltet",
      );
      revalidatePath(leadPath(id));
      revalidatePath(PATH);
      revalidatePath("/admin/kunden");
    },
    values,
  );
}

export async function contactMessageStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runCrmAction("viewCustomers", PATH, async (session) => {
    const status = str(formData, "status") as ContactStatus;
    if (!(CONTACT_STATUSES as readonly string[]).includes(status))
      return actionError("Bitte wähle einen Status.");
    const selected = ids(formData);
    const n = await setContactMessageStatus({ ids: selected, status }, session);
    await flashToast(
      `${n} ${n === 1 ? "Nachricht" : "Nachrichten"}: ${CONTACT_STATUS_LABELS[status]}`,
    );
    revalidatePath(PATH);
  });
}

export async function withdrawalStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runCrmAction("viewCustomers", PATH, async (session) => {
    const status = str(formData, "status") as WithdrawalStatus;
    if (!(WITHDRAWAL_STATUSES as readonly string[]).includes(status))
      return actionError("Bitte wähle einen Status.");
    await setWithdrawalStatus({ id: str(formData, "id"), status }, session);
    await flashToast(`Widerruf: ${WITHDRAWAL_STATUS_LABELS[status]}`);
    revalidatePath(PATH);
  });
}
