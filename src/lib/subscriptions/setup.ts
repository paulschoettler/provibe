import "server-only";
import type { CurrentCustomer } from "@/lib/auth/session";
import { integrations } from "@/lib/integrations";
import { storePaymentMethod } from "./checkout-hook";
import { loadSubscriptionRow } from "./db";
import type { RenewalOutcome } from "./renewal";
import { setPaymentMethod } from "./service";

/**
 * Abschluss eines Zahlungsmittelwechsels im Live-Betrieb: Stripe leitet nach confirmSetup auf
 * /account/abo/[id]/zahlungsmittel?setup_intent=seti_... zurück. Der Server liest den SetupIntent
 * bei Stripe (nie den Angaben im Browser vertrauen), prüft Abo und Kunde und speichert das
 * Zahlungsmittel. Ist eine Zahlung offen, wird sofort neu abgebucht.
 */
export async function finishSetupIntent(
  subscriptionId: string,
  setupIntentId: string,
  customer: CurrentCustomer,
): Promise<{ ok: true; charge?: RenewalOutcome } | { ok: false; reason: string }> {
  const row = await loadSubscriptionRow(subscriptionId);
  if (!row || row.customer_id !== customer.id) return { ok: false, reason: "not_found" };
  const payments = integrations().payments;
  const setup = await payments.retrieveSetupIntent(setupIntentId);
  if (setup.metadata.subscription_id !== row.id) return { ok: false, reason: "mismatch" };
  if (setup.status !== "succeeded" || !setup.paymentMethodId)
    return { ok: false, reason: setup.status };
  const method = await payments.retrievePaymentMethod(setup.paymentMethodId);
  const providerCustomerId =
    row.stripe_customer_id ?? (await payments.ensureCustomer({ email: customer.email })).id;
  const stored = await storePaymentMethod(customer.id, providerCustomerId, method);
  const result = await setPaymentMethod(row, stored, { type: "customer", id: customer.authUserId });
  return { ok: true, charge: result.charge };
}
