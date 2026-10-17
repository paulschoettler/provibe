"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import { runCrmAction, str } from "@/lib/admin/customers/crm-action";
import { resendEmailMessage } from "./resend";
import { removeSuppression } from "./suppressions";
import { sendTemplateTest, setTemplateEnabled, updateTemplateSubject } from "./templates";

/** Server Actions für /admin/emails (Owner und Admin, sendNewsletter). */

const PATH = "/admin/emails";

export async function updateTemplateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = { subject: str(formData, "subject"), description: str(formData, "description") };
  return runCrmAction(
    "sendNewsletter",
    PATH,
    async (session) => {
      await updateTemplateSubject(
        { key: str(formData, "key"), subject: values.subject, description: values.description },
        session,
      );
      await flashToast("Vorlage gespeichert");
      revalidatePath(PATH);
      revalidatePath("/admin/automationen");
    },
    values,
  );
}

export async function toggleTemplateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runCrmAction("sendNewsletter", PATH, async (session) => {
    const enabled = str(formData, "enabled") === "true";
    await setTemplateEnabled({ key: str(formData, "key"), enabled }, session);
    await flashToast(
      enabled ? "Vorlage eingeschaltet" : "Vorlage ausgeschaltet, Automation sendet nicht",
    );
    revalidatePath(PATH);
  });
}

export async function templateTestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const to = str(formData, "to");
  return runCrmAction(
    "sendNewsletter",
    PATH,
    async (session) => {
      const result = await sendTemplateTest({ key: str(formData, "key"), to }, session);
      await flashToast(
        result.status === "sent"
          ? `Testmail an ${to} verschickt`
          : `Testmail an ${to}: ${result.status}`,
        result.status === "sent" ? "success" : "error",
      );
      revalidatePath(PATH);
    },
    { to },
  );
}

export async function resendMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runCrmAction("sendNewsletter", PATH, async (session) => {
    const { label } = await resendEmailMessage(str(formData, "messageId"), session);
    await flashToast(`${label}: erneut ausgelöst, siehe Protokoll`);
    revalidatePath(PATH);
  });
}

export async function removeSuppressionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = { reason: str(formData, "reason") };
  return runCrmAction(
    "sendNewsletter",
    PATH,
    async (session) => {
      await removeSuppression({ email: str(formData, "email"), reason: values.reason }, session);
      await flashToast("Eintrag von der Sperrliste entfernt");
      revalidatePath(PATH);
    },
    values,
  );
}
