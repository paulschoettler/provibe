"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS, requireStaff, type StaffSession } from "@/lib/admin/auth";
import { revalidateCatalog } from "@/lib/admin/products/revalidate";
import {
  actionError,
  actionOk,
  fieldErrorsOf,
  type ActionState,
} from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import {
  adminApplyDiscountToExisting,
  adminCancel,
  adminPause,
  adminResume,
  adminRetryPayment,
  adminSetDiscount,
  adminSkip,
  getSettings,
  resolveCancellationRequest,
  saveSettings,
} from "./admin";
import { SubscriptionConflictError, loadSubscriptionRow } from "./db";
import type { RenewalOutcome } from "./renewal";
import { formatDay } from "./schedule";
import { SubscriptionActionError } from "./service";
import { CANCEL_REASONS } from "./types";

/**
 * Server Actions für /admin/abos. Jede Action prüft die Sitzung (requireStaff) und das Recht:
 * Pausieren, Fortsetzen, Überspringen, Kündigen und Kündigungsanfragen ab Support (nicht
 * Fulfillment); Rabatt, Zahlung erneut versuchen und Einstellungen nur Owner und Admin
 * (PERMISSIONS.editSettings). Audit-Log und Ereignis schreiben die Funktionen in admin.ts.
 */

const LIST = "/admin/abos";
const NO_RIGHT = "Dafür fehlt dir die Berechtigung.";
const GENERIC =
  "Das hat gerade nicht geklappt. Bitte lade die Seite neu und versuch es noch einmal.";

const uuid = z.string().uuid("Ungültiges Abo.");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte gib ein gültiges Datum an.");

/** Support, Admin und Owner dürfen den Ablauf eines Abos steuern, Fulfillment nicht. */
function canOperate(session: StaffSession): boolean {
  return PERMISSIONS.viewCustomers(session);
}

async function operator(id?: string) {
  const session = await requireStaff("support", { next: id ? `${LIST}/${id}` : LIST });
  return canOperate(session) ? session : null;
}

async function manager(id?: string) {
  const session = await requireStaff("support", { next: id ? `${LIST}/${id}` : LIST });
  return PERMISSIONS.editSettings(session) ? session : null;
}

function refresh(id: string) {
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${id}`);
}

function failure(error: unknown, values?: Record<string, string>): ActionState {
  if (error instanceof SubscriptionActionError) {
    return actionError(error.message, {
      fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      values,
    });
  }
  if (error instanceof SubscriptionConflictError) return actionError(error.message, { values });
  console.error("[admin] Abo-Aktion", error);
  return actionError(GENERIC, { values });
}

const OUTCOME_TEXT: Record<RenewalOutcome, { text: string; ok: boolean }> = {
  ordered: { text: "Zahlung erfolgreich, die Bestellung ist angelegt", ok: true },
  skipped: { text: "Lieferung übersprungen", ok: true },
  cancelled: { text: "Das Abo ist gekündigt, es wurde nichts abgebucht", ok: false },
  resumed_only: { text: "Abo fortgesetzt", ok: true },
  declined: { text: "Zahlung erneut abgelehnt, der Kunde bekommt eine Mail", ok: false },
  paused_after_failures: {
    text: "Zahlung erneut abgelehnt, das Abo ist jetzt pausiert",
    ok: false,
  },
  action_required: {
    text: "Die Bank verlangt eine Bestätigung (3-D Secure), der Kunde bekommt einen Link",
    ok: false,
  },
  stock_missing: { text: "Bestand fehlt, die Lieferung wurde um einen Tag verschoben", ok: false },
  not_due: { text: "Für dieses Abo ist gerade keine Zahlung offen", ok: false },
  locked: { text: "Das Abo wird gerade verarbeitet, versuch es gleich noch einmal", ok: false },
  error: { text: "Die Zahlung konnte nicht ausgeführt werden", ok: false },
};

/* ---------- Pausieren, Fortsetzen, Überspringen ---------- */

export async function pauseSubscriptionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const session = await operator(id);
  if (!session) return actionError(NO_RIGHT);
  const values = { until: String(formData.get("until") ?? "") };
  const parsed = z.object({ id: uuid, until: day }).safeParse({ id, until: values.until });
  if (!parsed.success) {
    return actionError("Bitte prüf das Datum.", {
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    });
  }
  try {
    const row = await adminPause(session, parsed.data.id, parsed.data.until);
    await flashToast(
      `${row.number} pausiert bis ${formatDay(row.paused_until ?? parsed.data.until)}`,
    );
  } catch (error) {
    return failure(error, values);
  }
  refresh(parsed.data.id);
  return actionOk();
}

export async function resumeSubscriptionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const session = await operator(id);
  if (!session) return actionError(NO_RIGHT);
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return actionError("Ungültiges Abo.");
  try {
    const result = await adminResume(session, parsed.data);
    if (result.charge) {
      const outcome = OUTCOME_TEXT[result.charge];
      await flashToast(outcome.text, outcome.ok ? "success" : "error");
    } else {
      await flashToast(`${result.row.number} läuft wieder, nächste Lieferung morgen`);
    }
  } catch (error) {
    return failure(error);
  }
  refresh(parsed.data);
  return actionOk();
}

export async function skipSubscriptionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const session = await operator(id);
  if (!session) return actionError(NO_RIGHT);
  const parsed = z
    .object({ id: uuid, skip: z.enum(["true", "false"]) })
    .safeParse({ id, skip: formData.get("skip") });
  if (!parsed.success) return actionError("Ungültige Eingabe.");
  const skip = parsed.data.skip === "true";
  try {
    const row = await adminSkip(session, parsed.data.id, skip);
    await flashToast(
      skip
        ? `Nächste Lieferung von ${row.number} wird übersprungen`
        : `${row.number} liefert wieder zum geplanten Termin`,
    );
  } catch (error) {
    return failure(error);
  }
  refresh(parsed.data.id);
  return actionOk();
}

/* ---------- Kündigen ---------- */

const REASON_IDS = CANCEL_REASONS.map((r) => r.id) as [string, ...string[]];

const cancelSchema = z
  .object({
    id: uuid,
    mode: z.enum(["next", "now", "date"], { message: "Bitte wähl einen Zeitpunkt." }),
    desiredDay: z.string().optional(),
    reason: z.enum([...REASON_IDS, "backoffice"], { message: "Bitte wähl einen Grund." }),
    note: z.string().trim().max(500, "Höchstens 500 Zeichen.").optional(),
    sendMail: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v.desiredDay ?? "")) {
      ctx.addIssue({ code: "custom", path: ["desiredDay"], message: "Bitte gib ein Datum an." });
    }
  });

export async function cancelSubscriptionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const session = await operator(id);
  if (!session) return actionError(NO_RIGHT);
  const values = {
    mode: String(formData.get("mode") ?? ""),
    desiredDay: String(formData.get("desiredDay") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    note: String(formData.get("note") ?? ""),
  };
  const parsed = cancelSchema.safeParse({
    id,
    mode: values.mode,
    desiredDay: values.desiredDay || undefined,
    reason: values.reason,
    note: values.note || undefined,
    sendMail: formData.get("sendMail") === "on",
  });
  if (!parsed.success) {
    return actionError("Bitte prüf die markierten Felder.", {
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    });
  }
  const v = parsed.data;
  const reasonLabel =
    CANCEL_REASONS.find((r) => r.id === v.reason)?.label ?? "Im Auftrag des Kunden (Backoffice)";
  try {
    const row = await adminCancel(session, v.id, {
      kind: v.mode === "now" ? "extraordinary" : "ordinary",
      timing: v.mode === "date" ? "date" : "next_possible",
      desiredDay: v.mode === "date" ? (v.desiredDay ?? null) : null,
      reason: [reasonLabel, v.note].filter(Boolean).join(": "),
      sendMail: v.sendMail,
    });
    await flashToast(
      row.status === "cancelled"
        ? `${row.number} ist gekündigt${v.sendMail ? ", die Bestätigung ist unterwegs" : ""}`
        : `Kündigung von ${row.number} zum ${formatDay(row.cancel_effective_at ?? new Date())} vorgemerkt`,
    );
  } catch (error) {
    return failure(error, values);
  }
  refresh(v.id);
  return actionOk();
}

/* ---------- Rabatt und Zahlung (Owner, Admin) ---------- */

const percent = z
  .string()
  .trim()
  .transform((s) => s.replace(",", ".").replace("%", "").trim())
  .pipe(
    z
      .string()
      .regex(/^\d{1,2}(\.\d{1,2})?$/, "Bitte gib eine Zahl zwischen 0 und 50 ein.")
      .transform((s) => Math.round(Number(s) * 100))
      .refine((bp) => bp >= 0 && bp <= 5000, "Der Rabatt muss zwischen 0 und 50 Prozent liegen."),
  );

export async function setSubscriptionDiscountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const session = await manager(id);
  if (!session) return actionError("Rabatte ändern dürfen nur Owner und Admin.");
  const values = {
    percent: String(formData.get("percent") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  };
  const parsed = z
    .object({
      id: uuid,
      percent,
      reason: z.string().trim().min(3, "Bitte gib kurz einen Grund an.").max(300),
      consent: z.boolean(),
    })
    .safeParse({
      id,
      percent: values.percent,
      reason: values.reason,
      consent: formData.get("consent") === "on",
    });
  if (!parsed.success) {
    return actionError("Bitte prüf die markierten Felder.", {
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    });
  }
  const current = await loadSubscriptionRow(parsed.data.id);
  if (!current) return actionError("Abo nicht gefunden.");
  if (current.discount_bp === parsed.data.percent) {
    return actionError("Der Rabatt ist schon so eingestellt.", { values });
  }
  // Weniger Rabatt ist eine Preiserhöhung: ohne wirksame Klausel (I17) nur mit Zustimmung des Kunden
  if (parsed.data.percent < current.discount_bp && !parsed.data.consent) {
    return actionError("Bitte bestätige, dass der Kunde dem höheren Preis zugestimmt hat.", {
      fieldErrors: { consent: "Zustimmung des Kunden bestätigen" },
      values,
    });
  }
  try {
    const row = await adminSetDiscount(session, parsed.data.id, parsed.data.percent, {
      reason: parsed.data.reason,
    });
    await flashToast(
      `Rabatt von ${row.number} auf ${(row.discount_bp / 100).toLocaleString("de-DE")} % gesetzt`,
    );
  } catch (error) {
    return failure(error, values);
  }
  refresh(parsed.data.id);
  return actionOk();
}

export async function retrySubscriptionPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const session = await manager(id);
  if (!session) return actionError("Zahlungen erneut auslösen dürfen nur Owner und Admin.");
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return actionError("Ungültiges Abo.");
  const row = await loadSubscriptionRow(parsed.data);
  if (!row) return actionError("Abo nicht gefunden.");
  if (row.status !== "past_due") return actionError("Für dieses Abo ist keine Zahlung offen.");
  try {
    const outcome = await adminRetryPayment(session, parsed.data);
    const text = OUTCOME_TEXT[outcome];
    await flashToast(text.text, text.ok ? "success" : "error");
  } catch (error) {
    return failure(error);
  }
  refresh(parsed.data);
  return actionOk();
}

/* ---------- Einstellungen (Owner, Admin) ---------- */

const SETTINGS_PATH = `${LIST}/einstellungen`;

function parseDayList(raw: string): number[] | null {
  const parts = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 60)) return null;
  return [...new Set(nums)].sort((a, b) => a - b);
}

export async function saveSubscriptionSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireStaff("support", { next: SETTINGS_PATH });
  if (!PERMISSIONS.editSettings(session)) {
    return actionError("Abo-Einstellungen ändern dürfen nur Owner und Admin.");
  }
  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string" && !k.startsWith("$")) values[k] = v;
  }
  const errors: Record<string, string> = {};

  const discount = percent.safeParse(String(formData.get("discountPercent") ?? ""));
  if (!discount.success) errors.discountPercent = discount.error.issues[0]?.message ?? "Ungültig";

  const intervals = formData
    .getAll("intervals")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 52);
  if (intervals.length === 0) errors.intervals = "Bitte wähl mindestens ein Intervall.";
  const defaultInterval = Number(formData.get("defaultInterval"));
  if (intervals.length && !intervals.includes(defaultInterval)) {
    errors.defaultInterval = "Das Standardintervall muss zu den erlaubten Intervallen gehören.";
  }

  const intField = (name: string, min: number, max: number, label: string) => {
    const n = Number(String(formData.get(name) ?? "").trim());
    if (!Number.isInteger(n) || n < min || n > max) {
      errors[name] = `${label}: ganze Zahl zwischen ${min} und ${max}.`;
      return null;
    }
    return n;
  };
  const pauseMaxDays = intField("pauseMaxDays", 7, 183, "Maximale Pause");
  const reminderDays = intField("reminderDays", 1, 14, "Erinnerung");
  const retryDays = parseDayList(String(formData.get("retryDays") ?? ""));
  if (retryDays === null) errors.retryDays = "Bitte Tage zwischen 1 und 60, getrennt durch Komma.";

  // Rabatt je Produkt: leeres Feld = Standard
  const current = await getSettings();
  const products: Record<string, number> = {};
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("product_") || typeof raw !== "string") continue;
    const productId = key.slice("product_".length);
    if (!/^[0-9a-f-]{36}$/i.test(productId) || raw.trim() === "") continue;
    const parsed = percent.safeParse(raw);
    if (!parsed.success) errors[key] = parsed.error.issues[0]?.message ?? "Ungültig";
    else products[productId] = parsed.data;
  }

  if (Object.keys(errors).length > 0 || !discount.success || retryDays === null) {
    return actionError("Bitte prüf die markierten Felder.", { fieldErrors: errors, values });
  }
  try {
    await saveSettings(session, {
      discountBp: discount.data,
      productDiscounts: { products, variants: current.productDiscounts.variants },
      intervals: [...new Set(intervals)].sort((a, b) => a - b),
      defaultInterval,
      pauseMaxDays: pauseMaxDays!,
      reminderDays: reminderDays!,
      retryDays,
    });
  } catch (error) {
    console.error("[admin] Abo-Einstellungen", error);
    return actionError(GENERIC, { values });
  }
  try {
    // Abo-Rabatt und Intervalle stehen auf den Produktseiten (Kaufbox)
    revalidateCatalog({ allProducts: true });
  } catch (error) {
    console.error("[admin] Revalidierung nach Abo-Einstellungen", error);
  }
  revalidatePath(SETTINGS_PATH);
  await flashToast("Abo-Einstellungen gespeichert");
  return actionOk();
}

export async function applyDiscountToExistingAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const session = await requireStaff("support", { next: SETTINGS_PATH });
  if (!PERMISSIONS.editSettings(session)) {
    return actionError("Das dürfen nur Owner und Admin.");
  }
  try {
    const settings = await getSettings();
    // Nur Abos, deren Rabatt steigt: weniger Rabatt wäre eine Preiserhöhung (I17, H28)
    const changed = await adminApplyDiscountToExisting(session, settings.discountBp, {
      onlyRaise: true,
    });
    await flashToast(
      changed === 0
        ? "Kein laufendes Abo musste angepasst werden"
        : `Standardrabatt auf ${changed} laufende Abos angewendet`,
    );
  } catch (error) {
    return failure(error);
  }
  revalidatePath(LIST);
  revalidatePath(SETTINGS_PATH);
  return actionOk();
}

/* ---------- Kündigungsanfragen ---------- */

export async function resolveCancellationRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireStaff("support", { next: `${LIST}/kuendigungen` });
  if (!canOperate(session)) return actionError(NO_RIGHT);
  const values = { note: String(formData.get("note") ?? "") };
  const parsed = z
    .object({
      id: z.string().uuid("Ungültige Anfrage."),
      note: z
        .string()
        .trim()
        .min(3, "Bitte notier kurz, wie der Fall geklärt wurde.")
        .max(1000, "Höchstens 1000 Zeichen."),
    })
    .safeParse({ id: formData.get("id"), note: values.note });
  if (!parsed.success) {
    return actionError("Bitte prüf die Notiz.", {
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    });
  }
  try {
    await resolveCancellationRequest(session, parsed.data.id, parsed.data.note);
    await flashToast("Kündigung als geklärt markiert");
  } catch (error) {
    return failure(error, values);
  }
  revalidatePath(`${LIST}/kuendigungen`);
  revalidatePath(`${LIST}/kuendigungen/${parsed.data.id}`);
  revalidatePath(LIST);
  return actionOk();
}
