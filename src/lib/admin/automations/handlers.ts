import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { renderCrmTemplate, type CrmTemplateKey } from "@/emails";
import { asJson, crmDb, dbError } from "@/lib/admin/customers/crm-db";
import {
  imageBaseUrl,
  loadImprint,
  oneClickUnsubscribeUrlFor,
  siteUrl,
  unsubscribeUrlFor,
} from "@/lib/admin/emails/context";
import { normalizeEmail } from "@/lib/admin/emails/policy";
import { sendTrackedEmail } from "@/lib/admin/emails/send";
import { isTemplateEnabled } from "@/lib/admin/emails/templates";
import { enqueueCrmJob, type CrmJobKind } from "./queue";
import {
  AUTOMATION_META,
  decideAbandonedCart,
  decideReviewRequest,
  decideWelcome,
  hasMarketingConsent,
  parseAutomationConfig,
  sweepBucket,
  type AutomationKey,
  type Decision,
} from "./rules";

/**
 * Job-Handler der Automationen (über runCrmJob in jobs.ts):
 *   automation.sweep           findet fällige Fälle, legt automation_runs an und reiht je Fall einen
 *                              Job ein; plant sich selbst im Viertelstundentakt neu ein.
 *   automation.welcome         Willkommensmail nach bestätigtem Opt-in
 *   automation.abandoned_cart  Warenkorberinnerung (24 h, Werbeeinwilligung)
 *   automation.review_request  Bewertungsanfrage (Werbeeinwilligung, H20)
 * Jeder Handler prüft beim Versand alle Bedingungen erneut. Versand nur über sendTrackedEmail
 * (Sperrliste und Allowlist bis zum Go-live).
 */

const SWEEP_LIMIT = 200;

interface AutomationRow {
  key: string;
  is_enabled: boolean;
  config: unknown;
}

async function loadAutomations(): Promise<Map<string, AutomationRow>> {
  const { data, error } = await crmDb().from("automations").select("key, is_enabled, config");
  if (error) throw dbError("Automationen laden", error);
  return new Map((data ?? []).map((a) => [a.key, a]));
}

async function consentByEmail(emails: string[]) {
  const map = new Map<
    string,
    {
      status: string;
      confirmed_at: string | null;
      unsubscribe_token: string;
      first_name: string | null;
    }
  >();
  const unique = Array.from(new Set(emails.map(normalizeEmail)));
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await crmDb()
      .from("newsletter_contacts")
      .select("email, status, confirmed_at, unsubscribe_token, first_name")
      .in("email", unique.slice(i, i + 200));
    for (const c of data ?? []) map.set(String(c.email).toLowerCase(), c);
  }
  return map;
}

async function existingRunTargets(key: AutomationKey, targetIds: string[]): Promise<Set<string>> {
  if (targetIds.length === 0) return new Set();
  const { data } = await crmDb()
    .from("automation_runs")
    .select("target_id")
    .eq("automation_key", key)
    .in("target_id", targetIds);
  return new Set((data ?? []).map((r) => r.target_id));
}

async function scheduleRun(
  key: AutomationKey,
  target: { type: "contact" | "cart" | "order"; id: string; email: string },
  scheduledFor: Date,
): Promise<boolean> {
  const db = crmDb();
  const { data, error } = await db
    .from("automation_runs")
    .upsert(
      {
        automation_key: key,
        target_type: target.type,
        target_id: target.id,
        email: normalizeEmail(target.email),
        status: "scheduled",
        scheduled_for: scheduledFor.toISOString(),
      },
      { onConflict: "automation_key,target_type,target_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw dbError("Automation einplanen", error);
  const runId = data?.[0]?.id;
  if (!runId) return false;
  await enqueueCrmJob({
    kind: AUTOMATION_META[key].jobKind as CrmJobKind,
    payload: { run_id: runId },
    idempotencyKey: `${AUTOMATION_META[key].jobKind}:${runId}`,
    runAt: scheduledFor.toISOString(),
    priority: 130,
  });
  return true;
}

/** Sweep: fällige Fälle finden und einplanen. Liefert die Zahl neu geplanter Läufe je Automation. */
export async function runAutomationSweep(
  now: Date = new Date(),
): Promise<Record<AutomationKey, number>> {
  const db = crmDb();
  const automations = await loadAutomations();
  const result: Record<AutomationKey, number> = {
    welcome: 0,
    abandoned_cart: 0,
    review_request: 0,
  };

  const welcome = automations.get("welcome");
  if (welcome?.is_enabled) {
    const cfg = parseAutomationConfig("welcome", welcome.config);
    const { data } = await db
      .from("newsletter_contacts")
      .select("id, email, confirmed_at")
      .eq("status", "subscribed")
      .neq("source", "import_shopify")
      .gte("confirmed_at", new Date(now.getTime() - 3 * 86400_000).toISOString())
      .order("confirmed_at")
      .limit(SWEEP_LIMIT);
    const done = await existingRunTargets(
      "welcome",
      (data ?? []).map((c) => c.id),
    );
    for (const c of data ?? []) {
      if (done.has(c.id) || !c.confirmed_at) continue;
      const due = new Date(
        Math.max(now.getTime(), new Date(c.confirmed_at).getTime() + cfg.delay_minutes * 60_000),
      );
      if (await scheduleRun("welcome", { type: "contact", id: c.id, email: c.email }, due))
        result.welcome++;
    }
  }

  const cart = automations.get("abandoned_cart");
  if (cart?.is_enabled) {
    const cfg = parseAutomationConfig("abandoned_cart", cart.config);
    const { data } = await db
      .from("carts")
      .select("id, email, last_activity_at")
      .eq("status", "active")
      .not("email", "is", null)
      .is("abandoned_email_sent_at", null)
      .is("converted_order_id", null)
      .lte(
        "last_activity_at",
        new Date(now.getTime() - Math.max(cfg.delay_hours, 24) * 3600_000).toISOString(),
      )
      .gte("last_activity_at", new Date(now.getTime() - cfg.max_age_days * 86400_000).toISOString())
      .limit(SWEEP_LIMIT);
    const rows = (data ?? []).filter((c): c is typeof c & { email: string } => Boolean(c.email));
    const done = await existingRunTargets(
      "abandoned_cart",
      rows.map((c) => c.id),
    );
    const consent = await consentByEmail(rows.map((c) => c.email));
    for (const c of rows) {
      if (done.has(c.id) || !hasMarketingConsent(consent.get(normalizeEmail(c.email)) ?? null))
        continue;
      if (await scheduleRun("abandoned_cart", { type: "cart", id: c.id, email: c.email }, now))
        result.abandoned_cart++;
    }
  }

  const review = automations.get("review_request");
  if (review?.is_enabled) {
    const cfg = parseAutomationConfig("review_request", review.config);
    const { data } = await db
      .from("orders")
      .select("id, email, delivered_at")
      .not("delivered_at", "is", null)
      .is("review_request_sent_at", null)
      .eq("is_test", false)
      .not("status", "in", "(cancelled,refunded)")
      .lte("delivered_at", new Date(now.getTime() - cfg.delay_days * 86400_000).toISOString())
      .gte("delivered_at", new Date(now.getTime() - 60 * 86400_000).toISOString())
      .limit(SWEEP_LIMIT);
    const done = await existingRunTargets(
      "review_request",
      (data ?? []).map((o) => o.id),
    );
    const consent = await consentByEmail((data ?? []).map((o) => o.email));
    for (const o of data ?? []) {
      if (done.has(o.id) || !hasMarketingConsent(consent.get(normalizeEmail(o.email)) ?? null))
        continue;
      if (await scheduleRun("review_request", { type: "order", id: o.id, email: o.email }, now))
        result.review_request++;
    }
  }

  // Nächsten Sweep einplanen, solange etwas eingeschaltet ist
  if ([welcome, cart, review].some((a) => a?.is_enabled)) {
    const bucket = sweepBucket(now);
    await enqueueCrmJob({
      kind: "automation.sweep",
      payload: { bucket: bucket.next },
      idempotencyKey: `automation.sweep:${bucket.next}`,
      runAt: bucket.next,
      priority: 150,
      maxAttempts: 3,
    });
  }
  return result;
}

/* Einzelne Läufe ----------------------------------------------------------------------------- */

async function loadRun(runId: string) {
  const { data, error } = await crmDb()
    .from("automation_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw dbError("Automationslauf laden", error);
  return data;
}

async function finishRun(
  runId: string,
  patch: {
    status: "sent" | "skipped" | "failed";
    skip_reason?: string;
    error?: string;
    token_hash?: string;
  },
) {
  await crmDb()
    .from("automation_runs")
    .update({ ...patch, sent_at: patch.status === "sent" ? new Date().toISOString() : null })
    .eq("id", runId);
}

/** Entscheidung umsetzen: final -> skipped, sonst Fehler werfen (Retry mit Backoff). */
async function applyDecision(runId: string, decision: Decision): Promise<boolean> {
  if (decision.send) return true;
  if (!decision.final) throw new Error(`Noch nicht fällig: ${decision.reason}`);
  await finishRun(runId, { status: "skipped", skip_reason: decision.reason });
  return false;
}

async function sendAutomationMail(input: {
  runId: string;
  key: AutomationKey;
  email: string;
  token: string;
  firstName: string | null;
  props: Record<string, unknown>;
  customerId: string | null;
  orderId?: string | null;
  tokenHash?: string;
}): Promise<"sent" | "skipped"> {
  const template = AUTOMATION_META[input.key].template as CrmTemplateKey;
  if (!(await isTemplateEnabled(template))) {
    await finishRun(input.runId, { status: "skipped", skip_reason: "Vorlage ausgeschaltet" });
    return "skipped";
  }
  const mail = renderCrmTemplate(
    template,
    { first_name: input.firstName, ...input.props },
    {
      entity: await loadImprint(),
      siteUrl: siteUrl(),
      imageBaseUrl: imageBaseUrl(),
      unsubscribeUrl: unsubscribeUrlFor(input.token),
    },
  );
  const result = await sendTrackedEmail({
    to: input.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    category: "marketing",
    template,
    unsubscribeUrl: unsubscribeUrlFor(input.token),
    listUnsubscribeUrl: oneClickUnsubscribeUrlFor(input.token),
    idempotencyKey: `automation:${input.runId}`,
    customerId: input.customerId,
    orderId: input.orderId ?? null,
    metadata: { automation: input.key, run_id: input.runId },
  });
  if (result.status !== "sent") {
    await finishRun(input.runId, {
      status: "skipped",
      skip_reason: result.status === "blocked_allowlist" ? "Allowlist (Testbetrieb)" : "Sperrliste",
    });
    return "skipped";
  }
  await finishRun(input.runId, { status: "sent", token_hash: input.tokenHash });
  if (input.customerId) {
    await crmDb()
      .from("customer_events")
      .insert({
        customer_id: input.customerId,
        kind: "automation_sent",
        data: asJson({ automation: AUTOMATION_META[input.key].name, run_id: input.runId }),
      });
  }
  return "sent";
}

async function customerIdFor(email: string): Promise<string | null> {
  const { data } = await crmDb()
    .from("customers")
    .select("id")
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  return data?.id ?? null;
}

export async function runWelcome(runId: string): Promise<void> {
  const run = await loadRun(runId);
  if (!run || run.status !== "scheduled") return;
  const automations = await loadAutomations();
  const { data: contact } = await crmDb()
    .from("newsletter_contacts")
    .select("id, email, status, confirmed_at, source, unsubscribe_token, first_name, customer_id")
    .eq("id", run.target_id)
    .maybeSingle();
  const decision = decideWelcome({
    enabled: Boolean(automations.get("welcome")?.is_enabled),
    contact: contact ?? null,
    alreadySent: false,
  });
  if (!(await applyDecision(runId, decision)) || !contact) return;
  await sendAutomationMail({
    runId,
    key: "welcome",
    email: String(contact.email),
    token: contact.unsubscribe_token,
    firstName: contact.first_name,
    props: {},
    customerId: contact.customer_id ?? (await customerIdFor(String(contact.email))),
  });
}

export async function runAbandonedCart(runId: string): Promise<void> {
  const run = await loadRun(runId);
  if (!run || run.status !== "scheduled") return;
  const db = crmDb();
  const automations = await loadAutomations();
  const row = automations.get("abandoned_cart");
  const config = parseAutomationConfig("abandoned_cart", row?.config);
  const { data: cart } = await db
    .from("carts")
    .select(
      "id, status, email, last_activity_at, abandoned_email_sent_at, converted_order_id, customer_id",
    )
    .eq("id", run.target_id)
    .maybeSingle();
  const { data: items } = await db
    .from("cart_items")
    .select(
      "quantity, product_variants(title, products(handle, product_translations(title, locale)))",
    )
    .eq("cart_id", run.target_id);
  const consent = cart?.email
    ? ((await consentByEmail([cart.email])).get(normalizeEmail(cart.email)) ?? null)
    : null;
  const decision = decideAbandonedCart({
    enabled: Boolean(row?.is_enabled),
    config,
    cart: cart ? { ...cart, item_count: items?.length ?? 0 } : null,
    consent,
    now: new Date(),
  });
  if (!(await applyDecision(runId, decision)) || !cart?.email || !consent) return;
  const lines = (items ?? []).map((i) => {
    const v = i.product_variants;
    const t = v?.products?.product_translations?.find((x) => x.locale === "de");
    return {
      title: t?.title ?? v?.products?.handle ?? "Artikel",
      quantity: i.quantity,
      variantTitle: v?.title ?? null,
    };
  });
  const sent = await sendAutomationMail({
    runId,
    key: "abandoned_cart",
    email: cart.email,
    token: consent.unsubscribe_token,
    firstName: consent.first_name,
    props: { items: lines },
    customerId: cart.customer_id ?? (await customerIdFor(cart.email)),
  });
  if (sent === "sent") {
    await db
      .from("carts")
      .update({ abandoned_email_sent_at: new Date().toISOString() })
      .eq("id", cart.id);
  }
}

export async function runReviewRequest(runId: string): Promise<void> {
  const run = await loadRun(runId);
  if (!run || run.status !== "scheduled") return;
  const db = crmDb();
  const automations = await loadAutomations();
  const row = automations.get("review_request");
  const config = parseAutomationConfig("review_request", row?.config);
  const { data: order } = await db
    .from("orders")
    .select(
      "id, order_number, email, status, delivered_at, review_request_sent_at, is_test, customer_id, order_items(product_title)",
    )
    .eq("id", run.target_id)
    .maybeSingle();
  const consent = order
    ? ((await consentByEmail([order.email])).get(normalizeEmail(order.email)) ?? null)
    : null;
  const decision = decideReviewRequest({
    enabled: Boolean(row?.is_enabled),
    config,
    order: order ?? null,
    consent,
    now: new Date(),
  });
  if (order?.is_test) {
    await finishRun(runId, { status: "skipped", skip_reason: "Testbestellung" });
    return;
  }
  if (!(await applyDecision(runId, decision)) || !order || !consent) return;
  // Bewertungslink: Token nur als Hash in automation_runs.token_hash (Prüfung im Bewertungsformular)
  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const sent = await sendAutomationMail({
    runId,
    key: "review_request",
    email: order.email,
    token: consent.unsubscribe_token,
    firstName: consent.first_name,
    props: {
      order_number: order.order_number,
      review_url: `${siteUrl()}/bewerten?token=${token}`,
      items: (order.order_items ?? []).map((i) => ({ title: i.product_title })),
    },
    customerId: order.customer_id,
    orderId: order.id,
    tokenHash,
  });
  if (sent === "sent") {
    await db
      .from("orders")
      .update({ review_request_sent_at: new Date().toISOString() })
      .eq("id", order.id);
  }
}
