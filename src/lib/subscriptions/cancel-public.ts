"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getShopSettings } from "@/lib/content/settings";
import { isTestAddress, setSummaryCookie } from "@/lib/forms/common";
import { CANCEL_COOKIE } from "./cancel-summary";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { matchCancellation } from "./cancellation";
import { aboDb } from "./db";
import {
  cancellationInternalEmail,
  cancellationReceiptEmail,
  type CancellationReceipt,
} from "./emails";
import { aboTitle, loadPricingContext, loadVariants, quoteDelivery } from "./catalog";
import { mailBase, sendAboMail } from "./mailer";
import { normalizeSubscriptionNumber } from "./rules";
import { formatDay } from "./schedule";
import { cancel } from "./service";
import type { AboFormState, SubscriptionRow } from "./types";

/**
 * Kündigung ohne Login (/abo-kuendigen, § 312k BGB, Entscheidung H23). Der Klick auf
 * "Jetzt kündigen" erklärt die Kündigung sofort: Die Erklärung wird gespeichert, passende Abos
 * werden gekündigt, die Seite zeigt Datum und Uhrzeit, die Eingangsbestätigung geht unverzüglich
 * per E-Mail an die angegebene Adresse. Passt kein Abo, wird trotzdem bestätigt und intern
 * geprüft; die Seite verrät nie, ob zu den Angaben ein Abo existiert.
 */

const CONFIRM_PATH = "/abo-kuendigen/bestaetigt";

const schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Bitte gib deinen Vor- und Nachnamen an.")
      .max(120, "Das ist zu lang."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Bitte gib eine gültige E-Mail-Adresse ein.")
      .max(200),
    subscriptionNumber: z
      .string()
      .trim()
      .max(20, "Bitte prüf die Abo-Nummer.")
      .refine(
        (v) => v === "" || normalizeSubscriptionNumber(v) !== null,
        "Bitte prüf die Abo-Nummer (zum Beispiel ABO-1001).",
      ),
    kind: z.enum(["ordinary", "extraordinary"], { message: "Bitte wähl die Art der Kündigung." }),
    reason: z.string().trim().max(1000, "Das ist zu lang."),
    timing: z.enum(["next_possible", "date"], { message: "Bitte wähl, wann das Abo enden soll." }),
    desiredDate: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "extraordinary" && v.reason.length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Bitte nenn uns den wichtigen Grund.",
      });
    }
    if (v.timing === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.desiredDate)) {
        ctx.addIssue({ code: "custom", path: ["desiredDate"], message: "Bitte gib ein Datum an." });
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const max = new Date(Date.now() + 2 * 365 * 86_400_000).toISOString().slice(0, 10);
      if (v.desiredDate < today || v.desiredDate > max) {
        ctx.addIssue({
          code: "custom",
          path: ["desiredDate"],
          message: "Bitte wähl ein Datum ab heute.",
        });
      }
    }
  });

const FIELDS = [
  "name",
  "email",
  "subscriptionNumber",
  "kind",
  "reason",
  "timing",
  "desiredDate",
] as const;

export async function cancelWithoutLogin(
  _prev: AboFormState,
  formData: FormData,
): Promise<AboFormState> {
  const values = Object.fromEntries(
    FIELDS.map((k) => [k, String(formData.get(k) ?? "").slice(0, 1000)]),
  );
  if (String(formData.get("website") ?? "")) redirect(CONFIRM_PATH as Route); // Honeypot

  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { status: "error", message: "Bitte prüf die markierten Felder.", fieldErrors, values };
  }
  const d = parsed.data;
  const limit = await checkRateLimit({ action: "abo-cancel", limit: 5, windowSeconds: 3600 });
  if (!limit.allowed) return { status: "error", message: RATE_LIMIT_MESSAGE, values };

  const receivedAt = new Date();
  const number = d.subscriptionNumber ? normalizeSubscriptionNumber(d.subscriptionNumber) : null;
  const db = aboDb();
  const { data: request, error } = await db
    .from("subscription_cancellation_requests")
    .insert({
      received_at: receivedAt.toISOString(),
      customer_name: d.name,
      email: d.email,
      subscription_number: number,
      kind: d.kind,
      reason: d.reason || null,
      timing: d.timing,
      desired_date: d.timing === "date" ? d.desiredDate : null,
      ip_hash: limit.ipHash,
      note: isTestAddress(d.email) ? "TEST" : null,
    })
    .select("id")
    .single();
  if (error || !request) {
    console.error("[abo] Kündigung nicht gespeichert", error?.message);
    return {
      status: "error",
      message:
        "Deine Kündigung konnte gerade nicht gespeichert werden. Bitte versuch es noch einmal oder schreib uns eine E-Mail.",
      values,
    };
  }
  const requestId = (request as { id: string }).id;

  // Passende Abos kündigen (E-Mail-Adresse des Kundenkontos, optional Abo-Nummer)
  const matched: { row: SubscriptionRow; effective: string }[] = [];
  try {
    const { data: customers } = await db.from("customers").select("id").eq("email", d.email);
    const ids = ((customers ?? []) as { id: string }[]).map((c) => c.id);
    if (ids.length > 0) {
      const { data: subs } = await db.from("subscriptions").select("*").in("customer_id", ids);
      const rows = (subs ?? []) as SubscriptionRow[];
      const targets = matchCancellation(rows, number);
      for (const target of targets) {
        const row = rows.find((r) => r.id === target.id)!;
        const result = await cancel(
          row,
          {
            kind: d.kind,
            timing: d.timing,
            desiredDay: d.timing === "date" ? d.desiredDate : null,
            reason: d.kind === "extraordinary" ? d.reason : null,
            sendMail: false,
            requestId,
          },
          { type: "public" },
          receivedAt,
        );
        matched.push({
          row: result.row,
          effective:
            result.plan.mode === "immediate"
              ? result.plan.effectiveAt.getTime() - receivedAt.getTime() < 60_000
                ? "sofort, keine weitere Lieferung"
                : `zum ${formatDay(result.plan.effectiveAt)}, keine weitere Lieferung`
              : `zum ${formatDay(result.plan.effectiveAt)}, bis dahin wie gewohnt`,
        });
      }
    }
  } catch (err) {
    console.error("[abo] Kündigung ohne Login: Zuordnung fehlgeschlagen", err);
  }

  await db
    .from("subscription_cancellation_requests")
    .update({
      status: matched.length > 0 ? "matched" : "unmatched",
      subscription_ids: matched.map((m) => m.row.id),
    })
    .eq("id", requestId);

  const receipt: CancellationReceipt = {
    name: d.name,
    email: d.email,
    subscriptionNumber: number,
    kind: d.kind,
    reason: d.kind === "extraordinary" ? d.reason : null,
    timing: d.timing,
    desiredDay: d.timing === "date" ? d.desiredDate : null,
    receivedAt,
    requestId,
  };
  const labels = await matchedLabels(matched.map((m) => m.row));
  const base = await mailBase(d.name.split(" ")[0] ?? null);
  const [confirmed] = await Promise.all([
    sendAboMail({
      to: d.email,
      mail: cancellationReceiptEmail(
        base,
        receipt,
        matched.map((m) => ({
          number: m.row.number,
          label: labels.get(m.row.id) ?? m.row.number,
          effective: m.effective,
        })),
      ),
      template: "subscription_cancellation_receipt",
      idempotencyKey: `subscription_cancellation_receipt:${requestId}`,
    }),
    getShopSettings().then((s) =>
      sendAboMail({
        to: s.contact.supportEmail,
        mail: cancellationInternalEmail(
          base,
          receipt,
          matched.map((m) => m.row.number),
        ),
        template: "subscription_cancellation_internal",
        idempotencyKey: `subscription_cancellation_internal:${requestId}`,
        category: "internal",
        replyTo: d.email,
      }),
    ),
  ]);
  if (confirmed === "sent" || confirmed === "blocked_allowlist") {
    await db
      .from("subscription_cancellation_requests")
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq("id", requestId);
  }

  await setSummaryCookie(CANCEL_COOKIE, "/abo-kuendigen", {
    name: d.name,
    email: d.email,
    number: number ?? "",
    kind: d.kind,
    timing: d.timing,
    desiredDate: d.timing === "date" ? d.desiredDate : "",
    receivedAt: receivedAt.toISOString(),
    reference: requestId.slice(0, 8).toUpperCase(),
  });
  redirect(CONFIRM_PATH as Route);
}

async function matchedLabels(rows: SubscriptionRow[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (rows.length === 0) return out;
  try {
    const [variants, pricing] = await Promise.all([
      loadVariants(rows.map((r) => r.variant_id)),
      loadPricingContext(),
    ]);
    for (const row of rows) {
      const variant = variants.get(row.variant_id);
      if (!variant) continue;
      const quote = quoteDelivery(row, variant, pricing);
      out.set(
        row.id,
        `${aboTitle(quote.line.productHandle, quote.line.productTitle)} · ${quote.line.variantTitle} · alle ${row.interval_count} Wochen`,
      );
    }
  } catch {
    // Bezeichnung ist nur Komfort
  }
  return out;
}
