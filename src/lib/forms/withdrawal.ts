"use server";

import { redirect } from "next/navigation";
import { getShopSettings, returnAddress } from "@/lib/content/settings";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { echoValues, isTestAddress, readFields, sendMail, setSummaryCookie } from "./common";
import { withdrawalConfirmationMail, withdrawalInternalMail } from "./emails";
import {
  fieldErrors,
  normalizeOrderNumber,
  withdrawalLookupSchema,
  withdrawalSchema,
} from "./schemas";
import { FORM_ERROR_TEXT, FORM_FAILURE_TEXT, type WithdrawalFormState } from "./state";

const FIELDS = ["orderNumber", "email", "name", "itemsText", "reason", "website"] as const;
const SENT_PATH = "/pages/widerruf-formular/gesendet";

/** Varianten einer eingegebenen Bestellnummer (neues Schema PV-000123, Shopify-Import #1042). */
function orderNumberCandidates(input: string): string[] {
  const n = normalizeOrderNumber(input);
  const digits = n.replace(/^PV-?/, "");
  const set = new Set([n, `#${n}`, digits, `#${digits}`]);
  if (/^\d+$/.test(digits)) set.add(`PV-${digits.padStart(6, "0")}`);
  return [...set];
}

/** Bestellung per Nummer und E-Mail finden (beides muss passen, sonst kein Treffer). */
async function findOrder(orderNumber: string, email: string) {
  const { data: order, error } = await supabaseAdmin()
    .from("orders")
    .select("id, order_number, order_items(product_title, variant_title, quantity)")
    .in("order_number", orderNumberCandidates(orderNumber))
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return order;
}

function itemLabel(i: { product_title: string; variant_title: string | null; quantity: number }) {
  const base = i.variant_title ? `${i.product_title}, ${i.variant_title}` : i.product_title;
  return i.quantity > 1 ? `${base} (${i.quantity} Stück)` : base;
}

/**
 * Elektronische Widerrufsfunktion (Briefing 5, Pflicht seit Juni 2026).
 * Zwei Schritte in einem Formular, beide ohne JavaScript nutzbar:
 * intent=lookup sucht die Bestellung und bietet ihre Artikel zur Auswahl an,
 * intent=submit speichert den Widerruf in withdrawal_requests und schickt sofort eine
 * Eingangsbestätigung per E-Mail. Die Suche ist optional: Artikel können immer auch als
 * Freitext angegeben werden, damit niemand am Widerruf gehindert wird.
 */
export async function submitWithdrawalForm(
  prev: WithdrawalFormState,
  formData: FormData,
): Promise<WithdrawalFormState> {
  const raw = readFields(formData, FIELDS);
  const items = formData
    .getAll("items")
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  const intent = formData.get("intent") === "lookup" ? "lookup" : "submit";
  const keep = { orderItems: prev.orderItems, lookup: prev.lookup };
  // Honeypot gefüllt: still beenden, für Bots sieht es nach Erfolg aus (kein Eintrag, keine Mail)
  if (raw.website) redirect(SENT_PATH);

  if (intent === "lookup") {
    const parsed = withdrawalLookupSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        status: "error",
        message: FORM_ERROR_TEXT,
        fieldErrors: fieldErrors(parsed.error),
        values: echoValues(raw),
        selectedItems: items,
      };
    }
    const limit = await checkRateLimit({
      action: "withdrawal-lookup",
      limit: 10,
      windowSeconds: 3600,
    });
    if (!limit.allowed) {
      return { status: "error", message: RATE_LIMIT_MESSAGE, values: echoValues(raw), ...keep };
    }
    try {
      const order = await findOrder(parsed.data.orderNumber, parsed.data.email);
      const orderItems = (order?.order_items ?? []).map((i) => {
        const label = itemLabel(i);
        return { value: label, label };
      });
      return {
        status: "idle",
        values: echoValues(raw),
        lookup: order ? "found" : "not_found",
        orderItems,
        selectedItems: items,
      };
    } catch (error) {
      console.error("[forms] Bestellsuche für Widerruf fehlgeschlagen", error);
      return { status: "idle", values: echoValues(raw), lookup: "not_found", orderItems: [] };
    }
  }

  const parsed = withdrawalSchema.safeParse({ ...raw, items });
  if (!parsed.success) {
    return {
      status: "error",
      message: FORM_ERROR_TEXT,
      fieldErrors: fieldErrors(parsed.error),
      values: echoValues(raw),
      selectedItems: items,
      ...keep,
    };
  }
  const d = parsed.data;

  const limit = await checkRateLimit({ action: "withdrawal", limit: 5, windowSeconds: 3600 });
  if (!limit.allowed) {
    return {
      status: "error",
      message: RATE_LIMIT_MESSAGE,
      values: echoValues(raw),
      selectedItems: items,
      ...keep,
    };
  }

  const itemsDescription = [...d.items, ...(d.itemsText ? [d.itemsText] : [])].join("\n");
  const receivedAt = new Date();
  const db = supabaseAdmin();
  let requestId: string;
  try {
    let orderId: string | null = null;
    try {
      orderId = (await findOrder(d.orderNumber, d.email))?.id ?? null;
    } catch {
      orderId = null;
    }
    const note = isTestAddress(d.email) ? "TEST" : null;
    const { data, error } = await db
      .from("withdrawal_requests")
      .insert({
        order_number: normalizeOrderNumber(d.orderNumber),
        order_id: orderId,
        customer_name: d.name,
        email: d.email,
        items_description: itemsDescription,
        message: [d.reason || null, note].filter(Boolean).join("\n") || null,
        status: "received",
        ip_hash: limit.ipHash,
      })
      .select("id")
      .single();
    if (error) throw error;
    requestId = data.id;
  } catch (error) {
    console.error("[forms] Widerruf konnte nicht gespeichert werden", error);
    return {
      status: "error",
      message: FORM_FAILURE_TEXT,
      values: echoValues(raw),
      selectedItems: items,
      ...keep,
    };
  }

  const settings = await getShopSettings();
  const mailData = {
    orderNumber: normalizeOrderNumber(d.orderNumber),
    email: d.email,
    name: d.name,
    items: itemsDescription,
    reason: d.reason ?? "",
    receivedAt,
    returnAddress: returnAddress(settings.legalEntity),
  };
  const [confirmed] = await Promise.all([
    sendMail(d.email, withdrawalConfirmationMail(mailData), {
      category: "transactional",
      template: "withdrawal_confirmation",
      idempotencyKey: `withdrawal-confirmation-${requestId}`,
    }),
    sendMail(settings.contact.supportEmail, withdrawalInternalMail(mailData, requestId), {
      category: "internal",
      template: "withdrawal_internal",
      replyTo: d.email,
      idempotencyKey: `withdrawal-internal-${requestId}`,
    }),
  ]);
  if (confirmed) {
    const { error } = await db
      .from("withdrawal_requests")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", requestId);
    if (error) console.error("[forms] Bestätigungszeitpunkt nicht gespeichert", error);
  }

  await setSummaryCookie("pv_withdrawal_sent", "/pages/widerruf-formular", {
    orderNumber: mailData.orderNumber,
    email: d.email,
    receivedAt: receivedAt.toISOString(),
  });
  redirect(SENT_PATH);
}
