import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { assertPermission, parseInput } from "./guard";
import { dbError, untypedCrm } from "./crm-db";
import { loadImprint } from "@/lib/admin/emails/context";

/**
 * Datenauskunft nach DSGVO Art. 15: alle personenbezogenen Daten eines Kunden aus allen Tabellen
 * als JSON. Recht viewCustomers (guard.ts), jeder Abruf landet im Protokoll (ohne Inhalt).
 * Sicherheitsrelevante Werte (Token-Hashes, Abmelde-Token, Stripe-IDs) werden entfernt, interne
 * Staff-IDs durch "PROVIBE Team" ersetzt.
 */

const SECRET_KEYS = new Set([
  "confirm_token_hash",
  "unsubscribe_token",
  "token_hash",
  "token",
  "stripe_customer_id",
  "stripe_payment_method_id",
  "stripe_subscription_id",
  "payment_intent_id",
  "resend_contact_id",
  "provider_message_id",
  "lexware_contact_id",
  "lexware_invoice_id",
  "invoice_pdf_path",
  "price_list_id",
]);
const STAFF_KEYS = new Set(["author_user_id", "blocked_by", "reviewed_by", "moderated_by"]);

/** Datensatz für die Auskunft bereinigen (rein, auch für Tests nutzbar). */
export function cleanRecord(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (SECRET_KEYS.has(key)) continue;
    if (STAFF_KEYS.has(key) || /_by$/.test(key) || key === "actor_user_id") {
      out[key] = value ? "PROVIBE Team" : null;
      continue;
    }
    if (Array.isArray(value))
      out[key] = value.map((v) =>
        v && typeof v === "object" && !Array.isArray(v)
          ? cleanRecord(v as Record<string, unknown>)
          : v,
      );
    else if (value && typeof value === "object")
      out[key] = cleanRecord(value as Record<string, unknown>);
    else out[key] = value;
  }
  return out;
}

export interface CustomerDataExport {
  meta: {
    erstellt_am: string;
    rechtsgrundlage: string;
    verantwortlicher: string | null;
    kunde_id: string;
    hinweis: string;
  };
  daten: Record<string, unknown>;
}

export async function buildCustomerDataExport(
  customerId: string,
  actor: StaffSession,
): Promise<{ export: CustomerDataExport; fileName: string }> {
  assertPermission(actor, "viewCustomers");
  const id = parseInput(z.string().uuid("Ungültige ID"), customerId);
  const db = untypedCrm();
  const { data: customer, error } = await db
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw dbError("Kunde laden", error);
  if (!customer) throw new Error("Kunde nicht gefunden");
  const email = String(customer.email).toLowerCase().replace(/"/g, "");
  const byCustomerOrEmail = `customer_id.eq.${id},email.eq."${email}"`;

  const q = async (label: string, run: () => PromiseLike<{ data: unknown; error: unknown }>) => {
    const res = await run();
    if (res.error) throw dbError(`Auskunft (${label})`, res.error as { message: string });
    return ((res.data as Record<string, unknown>[] | null) ?? []).map(cleanRecord);
  };

  const orders = await q("orders", () =>
    db
      .from("orders")
      .select("*, order_items(*), shipments(*), refunds(*), order_events(*), order_notes(*)")
      .eq("customer_id", id)
      .order("placed_at"),
  );
  const contacts = await q("newsletter_contacts", () =>
    db.from("newsletter_contacts").select("*").or(byCustomerOrEmail),
  );
  const contactIds = contacts.map((c) => String(c.id));
  const carts = await q("carts", () =>
    db.from("carts").select("*, cart_items(*)").or(byCustomerOrEmail),
  );

  const [
    addresses,
    events,
    notes,
    paymentMethods,
    recipients,
    emails,
    checkouts,
    consents,
    reviews,
    subscriptions,
    b2b,
    redemptions,
    contactMessages,
    withdrawals,
    leads,
    automationRuns,
  ] = await Promise.all([
    q("customer_addresses", () => db.from("customer_addresses").select("*").eq("customer_id", id)),
    q("customer_events", () =>
      db.from("customer_events").select("*").eq("customer_id", id).order("created_at"),
    ),
    q("customer_notes", () => db.from("customer_notes").select("*").eq("customer_id", id)),
    q("customer_payment_methods", () =>
      db
        .from("customer_payment_methods")
        .select("id, type, brand, last4, exp_month, exp_year, is_default, created_at")
        .eq("customer_id", id),
    ),
    contactIds.length
      ? q("campaign_recipients", () =>
          db
            .from("campaign_recipients")
            .select(
              "campaign_id, email, status, sent_at, delivered_at, opened_at, clicked_at, bounced_at, complained_at, unsubscribed_at",
            )
            .in("contact_id", contactIds),
        )
      : Promise.resolve([]),
    q("email_messages", () =>
      db
        .from("email_messages")
        .select(
          "id, to_email, subject, template, category, status, sent_at, delivered_at, opened_at, clicked_at, created_at, order_id",
        )
        .or(`customer_id.eq.${id},to_email.eq."${email}"`)
        .order("created_at"),
    ),
    q("checkout_sessions", () =>
      db
        .from("checkout_sessions")
        .select(
          "id, email, phone, status, shipping_address, billing_address, marketing_opt_in, order_id, created_at",
        )
        .or(byCustomerOrEmail),
    ),
    q("consent_logs", () => db.from("consent_logs").select("*").eq("customer_id", id)),
    q("reviews", () => db.from("reviews").select("*").eq("customer_id", id)),
    q("subscriptions", () =>
      db.from("subscriptions").select("*, subscription_orders(*)").eq("customer_id", id),
    ),
    q("b2b_applications", () => db.from("b2b_applications").select("*").eq("customer_id", id)),
    q("discount_redemptions", () =>
      db.from("discount_redemptions").select("*").or(byCustomerOrEmail),
    ),
    q("contact_messages", () => db.from("contact_messages").select("*").eq("email", email)),
    q("withdrawal_requests", () => db.from("withdrawal_requests").select("*").eq("email", email)),
    q("leads", () => db.from("leads").select("*").or(byCustomerOrEmail)),
    q("automation_runs", () =>
      db
        .from("automation_runs")
        .select("automation_key, target_type, email, status, scheduled_for, sent_at, skip_reason")
        .eq("email", email),
    ),
  ]);

  let login: Record<string, unknown> | null = null;
  if (customer.auth_user_id) {
    const { data } = await db.auth.admin.getUserById(String(customer.auth_user_id));
    if (data?.user)
      login = {
        email: data.user.email ?? null,
        erstellt_am: data.user.created_at,
        letzte_anmeldung: data.user.last_sign_in_at ?? null,
        email_bestaetigt_am: data.user.email_confirmed_at ?? null,
      };
  }

  const imprint = await loadImprint().catch(() => null);
  const now = new Date().toISOString();
  const result: CustomerDataExport = {
    meta: {
      erstellt_am: now,
      rechtsgrundlage: "Art. 15 DSGVO (Auskunftsrecht)",
      verantwortlicher: imprint
        ? [imprint.name, imprint.street, `${imprint.zip} ${imprint.city}`, imprint.email]
            .filter(Boolean)
            .join(", ")
        : null,
      kunde_id: id,
      hinweis:
        "Alle zu dieser Person gespeicherten Daten aus dem Shop, zugeordnet über Kunden-ID und E-Mail-Adresse. Zahlungsdaten liegen beim Zahlungsdienstleister, hier nur Kartentyp und Endziffern.",
    },
    daten: {
      kunde: cleanRecord(customer as Record<string, unknown>),
      kundenkonto: login,
      adressen: addresses,
      bestellungen: orders,
      abos: subscriptions,
      newsletter_kontakte: contacts,
      kampagnen_empfang: recipients,
      versandprotokoll: emails,
      automationen: automationRuns,
      warenkoerbe: carts,
      checkouts: checkouts,
      gespeicherte_zahlarten: paymentMethods,
      rabatt_einloesungen: redemptions,
      bewertungen: reviews,
      cookie_einwilligungen: consents,
      kontaktanfragen: contactMessages,
      widerrufe: withdrawals,
      partneranfragen: leads,
      b2b_antraege: b2b,
      aktivitaeten: events,
      interne_notizen: notes,
    },
  };
  await writeAudit(actor, {
    action: "customer.data_export",
    entityType: "customer",
    entityId: id,
    after: {
      tables: Object.fromEntries(
        Object.entries(result.daten).map(([k, v]) => [k, Array.isArray(v) ? v.length : v ? 1 : 0]),
      ),
    },
  });
  return { export: result, fileName: `datenauskunft-${id}-${now.slice(0, 10)}.json` };
}
