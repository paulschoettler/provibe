"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import {
  actionError,
  actionOk,
  fieldErrorsOf,
  type ActionState,
} from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import { resetStaffMfa } from "./mfa";
import { checkMfaReset, ROLE_LABELS } from "./rules";
import {
  changeStaffRole,
  inviteStaff,
  listStaffOverview,
  revokeInvite,
  setStaffActive,
} from "./users";

/**
 * Server Actions für /admin/einstellungen/benutzer. Jede Action prüft die Sitzung (requireStaff)
 * und das Recht manageUsers (nur Owner, H19); die Regeln selbst stehen in rules.ts, die Protokolle
 * schreibt users.ts beziehungsweise mfa.ts.
 */
const PATH = "/admin/einstellungen/benutzer";
const NO_RIGHT = "Benutzer verwalten dürfen nur Owner.";

const role = z.enum(["owner", "admin", "support", "fulfillment"], {
  message: "Bitte wähle eine Rolle.",
});
const userId = z.string().uuid();

async function owner() {
  const session = await requireStaff("support", { next: PATH });
  return PERMISSIONS.manageUsers(session) ? session : null;
}

const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Bitte gib eine gültige E-Mail-Adresse ein.")
    .max(254),
  role,
});

export async function inviteStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await owner();
  if (!session) return actionError(NO_RIGHT);
  const values = {
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? ""),
  };
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return actionError("Bitte prüf die markierten Felder.", {
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    });
  }
  const result = await inviteStaff(session, parsed.data.email, parsed.data.role);
  if (!result.ok) return actionError(result.reason, { values });
  const text =
    result.result === "invited"
      ? `Einladung an ${parsed.data.email} verschickt`
      : `${parsed.data.email} hat jetzt Zugang als ${ROLE_LABELS[parsed.data.role]}`;
  await flashToast(
    result.mailed ? text : `${text} (Mail nicht zugestellt, Link per Magic Link anfordern)`,
  );
  revalidatePath(PATH);
  return actionOk();
}

export async function changeRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await owner();
  if (!session) return actionError(NO_RIGHT);
  const parsed = z
    .object({ userId, role })
    .safeParse({ userId: formData.get("userId"), role: formData.get("role") });
  if (!parsed.success)
    return actionError("Ungültige Eingabe.", { fieldErrors: fieldErrorsOf(parsed.error) });
  const result = await changeStaffRole(session, parsed.data.userId, parsed.data.role);
  if (!result.ok) return actionError(result.reason);
  await flashToast(`Rolle auf ${ROLE_LABELS[parsed.data.role]} geändert`);
  revalidatePath(PATH);
  return actionOk();
}

export async function setActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await owner();
  if (!session) return actionError(NO_RIGHT);
  const parsed = z
    .object({ userId, active: z.enum(["true", "false"]) })
    .safeParse({ userId: formData.get("userId"), active: formData.get("active") });
  if (!parsed.success) return actionError("Ungültige Eingabe.");
  const active = parsed.data.active === "true";
  const result = await setStaffActive(session, parsed.data.userId, active);
  if (!result.ok) return actionError(result.reason);
  await flashToast(
    active ? "Benutzer wieder aktiviert" : "Benutzer deaktiviert, der Zugang ist gesperrt",
  );
  revalidatePath(PATH);
  return actionOk();
}

export async function resetMfaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await owner();
  if (!session) return actionError(NO_RIGHT);
  const parsed = userId.safeParse(formData.get("userId"));
  if (!parsed.success) return actionError("Ungültige Eingabe.");
  const target = (await listStaffOverview()).find((s) => s.userId === parsed.data);
  if (!target) return actionError("Benutzer nicht gefunden.");
  const check = checkMfaReset(session, {
    userId: parsed.data,
    role: target.role,
    isActive: target.isActive,
  });
  if (!check.ok) return actionError(check.reason);
  try {
    await resetStaffMfa(session, parsed.data);
  } catch (error) {
    console.error("[admin] Zwei-Faktor zurücksetzen fehlgeschlagen", error);
    return actionError("Zurücksetzen fehlgeschlagen. Bitte versuch es noch einmal.");
  }
  await flashToast(
    `Zwei-Faktor für ${target.email} zurückgesetzt. Beim nächsten Login wird neu eingerichtet.`,
  );
  revalidatePath(PATH);
  return actionOk();
}

export async function revokeInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await owner();
  if (!session) return actionError(NO_RIGHT);
  const parsed = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!parsed.success) return actionError("Ungültige Eingabe.");
  const result = await revokeInvite(session, parsed.data);
  if (!result.ok) return actionError(result.reason);
  await flashToast("Einladung zurückgezogen");
  revalidatePath(PATH);
  return actionOk();
}
