"use server";

import { revalidatePath } from "next/cache";
import { actionError, type ActionState } from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import { runCrmAction, str } from "@/lib/admin/customers/crm-action";
import { sendAutomationTest, updateAutomation } from "./automations";
import { AUTOMATION_KEYS, AUTOMATION_META, type AutomationKey } from "./rules";

/** Server Actions der Automationen (Owner und Admin, sendNewsletter). */

const PATH = "/admin/automationen";

function keyOf(formData: FormData): AutomationKey | null {
  const key = str(formData, "key");
  return (AUTOMATION_KEYS as readonly string[]).includes(key) ? (key as AutomationKey) : null;
}

const CONFIG_FIELDS: Record<AutomationKey, string[]> = {
  welcome: ["delay_minutes", "discount_code"],
  abandoned_cart: ["delay_hours", "max_age_days", "discount_code"],
  review_request: ["delay_days"],
};

export async function updateAutomationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const key = keyOf(formData);
  const values = Object.fromEntries(
    (key ? CONFIG_FIELDS[key] : []).map((f) => [f, str(formData, f)]),
  );
  return runCrmAction(
    "sendNewsletter",
    PATH,
    async (session) => {
      if (!key) return actionError("Unbekannte Automation.");
      const config: Record<string, unknown> = {};
      for (const f of CONFIG_FIELDS[key]) {
        const v = str(formData, f);
        config[f] = f === "discount_code" ? v || undefined : v;
      }
      const isEnabled = formData.get("enabled") === "on";
      await updateAutomation({ key, isEnabled, config }, session);
      await flashToast(
        `${AUTOMATION_META[key].name}: ${isEnabled ? "eingeschaltet" : "ausgeschaltet"}, gespeichert`,
      );
      revalidatePath(PATH);
    },
    values,
  );
}

export async function sendAutomationTestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const to = str(formData, "to");
  return runCrmAction(
    "sendNewsletter",
    PATH,
    async (session) => {
      const key = keyOf(formData);
      if (!key) return actionError("Unbekannte Automation.");
      const result = await sendAutomationTest({ key, to }, session);
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
