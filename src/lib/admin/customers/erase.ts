import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { PermissionError, parseInput } from "./guard";
import { dbError, untypedCrm } from "./crm-db";
import {
  ERASED_REVIEW_AUTHOR,
  checkoutSessionPatch,
  contactMessagePatch,
  erasureBlockers,
  leadPatch,
  newsletterContactPatch,
  orderPatch,
  pseudonymEmail,
  scrubsEmailMessage,
} from "./erasure";

/**
 * Löschung auf Antrag (DSGVO Art. 17) aus dem Backoffice. Nur Owner und Admin.
 * Ablauf: Regeln prüfen (erasure.ts), Login löschen, anonymize_customer (gemeinsam mit der
 * Kontolöschung im Kundenkonto), danach die übrigen Tabellen nach ERASURE_RULES. Bricht ein
 * späterer Schritt ab, ist der Kunde schon pseudonymisiert; der Fehler steht im Server-Log mit
 * der Tabelle, die übrigen Schritte lassen sich dann per SQL nachholen (siehe Bericht W2-C).
 * Das Protokoll enthält keine personenbezogenen Daten, nur IDs und Zähler.
 */

const schema = z.object({
  customerId: z.string().uuid("Ungültige ID"),
  confirmEmail: z.string().trim().min(1, "Bitte gib die E-Mail-Adresse des Kunden ein.").max(254),
  reason: z.string().trim().max(300).optional(),
});

export interface EraseResult {
  customerId: string;
  counts: Record<string, number>;
}

export class ErasureBlockedError extends Error {
  readonly blockers: string[];
  constructor(blockers: string[]) {
    super(blockers[0] ?? "Löschung nicht möglich");
    this.name = "ErasureBlockedError";
    this.blockers = blockers;
  }
}

export async function eraseCustomer(
  input: z.input<typeof schema>,
  actor: StaffSession,
): Promise<EraseResult> {
  if (actor.role !== "owner" && actor.role !== "admin") throw new PermissionError();
  const data = parseInput(schema, input);
  const db = untypedCrm();

  const { data: customer, error } = await db
    .from("customers")
    .select("id, email, auth_user_id, anonymized_at")
    .eq("id", data.customerId)
    .maybeSingle();
  if (error) throw dbError("Kunde laden", error);
  if (!customer) throw new Error("Kunde nicht gefunden");
  const email = String(customer.email).toLowerCase();

  const [{ data: orders }, { data: subscriptions }] = await Promise.all([
    db.from("orders").select("order_number, status, is_test").eq("customer_id", customer.id),
    db.from("subscriptions").select("status").eq("customer_id", customer.id),
  ]);
  const blockers = erasureBlockers({
    customerEmail: email,
    confirmEmail: data.confirmEmail,
    anonymizedAt: customer.anonymized_at,
    orders: orders ?? [],
    subscriptions: subscriptions ?? [],
  });
  if (blockers.length > 0) throw new ErasureBlockedError(blockers);

  const counts: Record<string, number> = {};
  const count = (key: string, n: number | null | undefined) => {
    counts[key] = (counts[key] ?? 0) + (n ?? 0);
  };
  const now = new Date().toISOString();

  // Newsletter-Kontakte vor anonymize_customer bestimmen (danach ist die E-Mail ersetzt)
  const { data: contacts } = await db
    .from("newsletter_contacts")
    .select("id")
    .or(`customer_id.eq.${customer.id},email.eq."${email.replace(/"/g, "")}"`);
  const contactIds = (contacts ?? []).map((c: { id: string }) => c.id);

  // 1. Login löschen
  if (customer.auth_user_id) {
    const { error: authError } = await db.auth.admin.deleteUser(customer.auth_user_id);
    if (authError && !/not.?found/i.test(authError.message))
      throw dbError("Login löschen", authError);
    count("auth.users", 1);
  }

  // 2. Kunde pseudonymisieren, Adressen löschen, aktive Warenkörbe lösen (gemeinsame Funktion)
  const { error: rpcError } = await db.rpc("anonymize_customer", { p_customer_id: customer.id });
  if (rpcError) throw dbError("Kunde pseudonymisieren", rpcError);
  count("customers", 1);

  // 3. Weitere Tabellen
  const step = async (
    key: string,
    run: () => PromiseLike<{ error: unknown; count?: number | null }>,
  ) => {
    const res = await run();
    if (res.error) throw dbError(`Löschung (${key})`, res.error as { message: string });
    count(key, res.count);
  };

  await step("customer_notes", () =>
    db.from("customer_notes").delete({ count: "exact" }).eq("customer_id", customer.id),
  );
  await step("customer_payment_methods", () =>
    db.from("customer_payment_methods").delete({ count: "exact" }).eq("customer_id", customer.id),
  );
  await step("customer_events", () =>
    db
      .from("customer_events")
      .update({ data: {} }, { count: "exact" })
      .eq("customer_id", customer.id),
  );
  for (const id of contactIds) {
    await step("newsletter_contacts", () =>
      db
        .from("newsletter_contacts")
        .update(newsletterContactPatch(id, now), { count: "exact" })
        .eq("id", id),
    );
    await step("campaign_recipients", () =>
      db
        .from("campaign_recipients")
        .update({ email: pseudonymEmail(id) }, { count: "exact" })
        .eq("contact_id", id),
    );
  }
  await step("automation_runs", () =>
    db
      .from("automation_runs")
      .update({ email: pseudonymEmail(customer.id) }, { count: "exact" })
      .eq("email", email),
  );
  const { data: messages } = await db
    .from("email_messages")
    .select("id, category")
    .or(`customer_id.eq.${customer.id},to_email.eq."${email.replace(/"/g, "")}"`);
  const scrub = (messages ?? [])
    .filter((m: { category: string }) => scrubsEmailMessage(m.category))
    .map((m: { id: string }) => m.id);
  if (scrub.length > 0)
    await step("email_messages", () =>
      db
        .from("email_messages")
        .update({ to_email: pseudonymEmail(customer.id), metadata: {} }, { count: "exact" })
        .in("id", scrub),
    );
  await step("carts", () =>
    db
      .from("carts")
      .update({ customer_id: null, email: null }, { count: "exact" })
      .eq("customer_id", customer.id),
  );
  await step("checkout_sessions", () =>
    db
      .from("checkout_sessions")
      .update(checkoutSessionPatch(), { count: "exact" })
      .is("order_id", null)
      .or(`customer_id.eq.${customer.id},email.eq."${email.replace(/"/g, "")}"`),
  );
  await step("orders", () =>
    db.from("orders").update(orderPatch(), { count: "exact" }).eq("customer_id", customer.id),
  );
  await step("discount_redemptions", () =>
    db
      .from("discount_redemptions")
      .update({ email: pseudonymEmail(customer.id) }, { count: "exact" })
      .or(`customer_id.eq.${customer.id},email.eq."${email.replace(/"/g, "")}"`),
  );
  await step("reviews", () =>
    db
      .from("reviews")
      .update({ author_name: ERASED_REVIEW_AUTHOR }, { count: "exact" })
      .eq("customer_id", customer.id),
  );
  await step("subscriptions", () =>
    db
      .from("subscriptions")
      .update({ shipping_address: null }, { count: "exact" })
      .eq("customer_id", customer.id),
  );
  await step("b2b_applications", () =>
    db
      .from("b2b_applications")
      .update({ message: null }, { count: "exact" })
      .eq("customer_id", customer.id),
  );
  await step("consent_logs", () =>
    db
      .from("consent_logs")
      .update({ customer_id: null }, { count: "exact" })
      .eq("customer_id", customer.id),
  );
  const { data: inbox } = await db.from("contact_messages").select("id").eq("email", email);
  for (const m of inbox ?? [])
    await step("contact_messages", () =>
      db
        .from("contact_messages")
        .update(contactMessagePatch(m.id), { count: "exact" })
        .eq("id", m.id),
    );
  const { data: leads } = await db
    .from("leads")
    .select("id")
    .or(`customer_id.eq.${customer.id},email.eq."${email.replace(/"/g, "")}"`);
  for (const l of leads ?? [])
    await step("leads", () =>
      db.from("leads").update(leadPatch(l.id), { count: "exact" }).eq("id", l.id),
    );

  await db.from("customer_events").insert({
    customer_id: customer.id,
    kind: "erased_by_staff",
    data: { role: actor.role },
  });
  await writeAudit(actor, {
    action: "customer.erase",
    entityType: "customer",
    entityId: customer.id,
    after: { counts, reason: data.reason || null },
  });
  return { customerId: customer.id, counts };
}
