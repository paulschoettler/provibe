import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { assertPermission, parseInput } from "@/lib/admin/customers/guard";
import { sendActivationLink } from "@/lib/admin/customers/actions";
import { resendOrderMail } from "@/lib/admin/orders/resend";
import { getEmailMessage } from "./log";

/**
 * "Erneut senden" im Versandprotokoll. Der Mailinhalt wird nicht gespeichert, deshalb wird die Mail
 * über ihren Auslöser neu erzeugt: Bestell-, Versand- und Erstattungsmails über das Bestellmodul,
 * der Aktivierungslink über das Kundenprofil. Werbemails (Kampagnen, Automationen) werden nie von
 * Hand erneut verschickt. Owner und Admin.
 */

const ORDER_TEMPLATES = ["order_confirmation", "shipping_confirmation", "refund_confirmation"];

export type ResendSupport = { ok: true; label: string } | { ok: false; reason: string };

/** Ob und wie eine protokollierte Mail erneut gesendet werden kann (für die Anzeige). */
export function resendSupport(entry: {
  template: string;
  category: string;
  orderId: string | null;
  customerId: string | null;
}): ResendSupport {
  if (entry.category === "marketing")
    return { ok: false, reason: "Werbemails werden nicht von Hand erneut verschickt." };
  if (ORDER_TEMPLATES.includes(entry.template)) {
    return entry.orderId
      ? { ok: true, label: "Über die Bestellung neu erzeugen und senden" }
      : { ok: false, reason: "Ohne Bezug zur Bestellung nicht möglich." };
  }
  if (entry.template === "account_activate")
    return entry.customerId
      ? { ok: true, label: "Neuen Aktivierungslink senden" }
      : { ok: false, reason: "Ohne Bezug zum Kunden nicht möglich." };
  return {
    ok: false,
    reason:
      "Diese Mail entsteht im Shop selbst (zum Beispiel Double Opt-in) und lässt sich hier nicht neu auslösen.",
  };
}

export async function resendEmailMessage(
  messageId: string,
  actor: StaffSession,
): Promise<{ label: string }> {
  assertPermission(actor, "sendNewsletter");
  const id = parseInput(z.string().uuid("Ungültige ID"), messageId);
  const entry = await getEmailMessage(id);
  if (!entry) throw new Error("Nachricht nicht gefunden");
  const support = resendSupport(entry);
  if (!support.ok) throw new Error(support.reason);
  let label: string;
  if (ORDER_TEMPLATES.includes(entry.template) && entry.orderId) {
    label = (await resendOrderMail(entry.orderId, entry.template, actor)).label;
  } else {
    const res = await sendActivationLink(entry.customerId as string, actor);
    if (res.status === "not_allowed") throw new Error(res.reason);
    if (res.status === "already_active") throw new Error("Das Konto ist schon aktiv.");
    label = res.status === "sent" ? "Aktivierungslink" : "Aktivierungslink (Allowlist blockiert)";
  }
  await writeAudit(actor, {
    action: "email_message.resend",
    entityType: "email_message",
    entityId: id,
    after: { template: entry.template },
  });
  return { label };
}
