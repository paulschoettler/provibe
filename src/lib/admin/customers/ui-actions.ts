"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import {
  addCustomerNote,
  addCustomerTag,
  blockCustomer,
  deleteCustomerNote,
  removeCustomerTag,
  sendActivationLink,
  unblockCustomer,
} from "./actions";
import { runCrmAction, str } from "./crm-action";
import { ErasureBlockedError, eraseCustomer } from "./erase";

/**
 * Server Actions des Kundenprofils (/admin/kunden/[id]). Support darf Tags und Notizen schreiben
 * (viewCustomers), Sperren, Entsperren und Löschen nur Owner und Admin.
 */

const PATH = "/admin/kunden";
const uuid = z.string().uuid();

function customerPath(formData: FormData): string {
  const id = str(formData, "customerId");
  return uuid.safeParse(id).success ? `${PATH}/${id}` : PATH;
}

function done(path: string) {
  revalidatePath(path);
  revalidatePath(PATH);
}

export async function addTagAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const path = customerPath(formData);
  return runCrmAction("viewCustomers", path, async (session) => {
    const tag = str(formData, "tag");
    if (!tag)
      return actionError("Bitte gib einen Tag ein.", { fieldErrors: { tag: "Pflichtfeld" } });
    const tags = await addCustomerTag({ customerId: str(formData, "customerId"), tag }, session);
    await flashToast(`Tag „${tag}“ gesetzt (${tags.length} Tags)`);
    done(path);
  });
}

export async function removeTagAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const path = customerPath(formData);
  return runCrmAction("viewCustomers", path, async (session) => {
    const tag = str(formData, "tag");
    await removeCustomerTag({ customerId: str(formData, "customerId"), tag }, session);
    await flashToast(`Tag „${tag}“ entfernt`);
    done(path);
  });
}

export async function addNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const path = customerPath(formData);
  return runCrmAction(
    "viewCustomers",
    path,
    async (session) => {
      await addCustomerNote(
        { customerId: str(formData, "customerId"), body: String(formData.get("body") ?? "") },
        session,
      );
      await flashToast("Notiz gespeichert");
      done(path);
    },
    { body: String(formData.get("body") ?? "") },
  );
}

export async function deleteNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const path = customerPath(formData);
  return runCrmAction("viewCustomers", path, async (session) => {
    await deleteCustomerNote({ noteId: str(formData, "noteId") }, session);
    await flashToast("Notiz gelöscht");
    done(path);
  });
}

export async function blockCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const path = customerPath(formData);
  return runCrmAction(
    "ownerOrAdmin",
    path,
    async (session) => {
      await blockCustomer(
        { customerId: str(formData, "customerId"), reason: str(formData, "reason") },
        session,
      );
      await flashToast("Kunde gesperrt, Login und Konto sind blockiert");
      done(path);
    },
    { reason: str(formData, "reason") },
  );
}

export async function unblockCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const path = customerPath(formData);
  return runCrmAction("ownerOrAdmin", path, async (session) => {
    await unblockCustomer({ customerId: str(formData, "customerId") }, session);
    await flashToast("Sperre aufgehoben");
    done(path);
  });
}

export async function sendActivationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const path = customerPath(formData);
  return runCrmAction("viewCustomers", path, async (session) => {
    const result = await sendActivationLink(str(formData, "customerId"), session);
    const messages = {
      sent: "Aktivierungslink verschickt",
      already_active: "Das Konto ist schon aktiv",
      blocked_allowlist: "Nicht verschickt: Bis zum Go-live gehen Mails nur an die Allowlist",
      not_allowed: "Nicht möglich",
    } as const;
    const text =
      result.status === "not_allowed"
        ? `${messages.not_allowed}: ${result.reason}`
        : messages[result.status];
    await flashToast(text, result.status === "sent" ? "success" : "error");
    done(path);
  });
}

export async function eraseCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const path = customerPath(formData);
  const values = { confirmEmail: str(formData, "confirmEmail"), reason: str(formData, "reason") };
  return runCrmAction(
    "ownerOrAdmin",
    path,
    async (session) => {
      try {
        const result = await eraseCustomer(
          {
            customerId: str(formData, "customerId"),
            confirmEmail: values.confirmEmail,
            reason: values.reason || undefined,
          },
          session,
        );
        const total = Object.values(result.counts).reduce((a, b) => a + b, 0);
        await flashToast(`Kundendaten gelöscht und pseudonymisiert (${total} Datensätze)`);
        done(path);
        return actionOk();
      } catch (error) {
        if (error instanceof ErasureBlockedError) {
          const emailWrong = error.blockers.some((b) => b.includes("E-Mail-Adresse"));
          return actionError(error.blockers.join(" "), {
            values,
            fieldErrors: emailWrong ? { confirmEmail: "Stimmt nicht mit dem Kunden überein" } : {},
          });
        }
        throw error;
      }
    },
    values,
  );
}
