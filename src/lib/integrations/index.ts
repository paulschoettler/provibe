import "server-only";
import { serverEnv } from "@/lib/env/server";
import { MockEmailProvider } from "./email/mock";
import { ResendEmailProvider } from "./email/resend";
import type { EmailProvider } from "./email/types";
import { LexwareInvoiceProvider } from "./invoicing/lexware";
import { MockInvoiceProvider } from "./invoicing/mock";
import type { InvoiceProvider } from "./invoicing/types";
import { MockPaymentProvider } from "./payments/mock";
import { StripePaymentProvider } from "./payments/stripe";
import type { PaymentProvider } from "./payments/types";
import { DhlShippingProvider } from "./shipping/dhl";
import { MockShippingProvider } from "./shipping/mock";
import type { ShippingProvider } from "./shipping/types";

/**
 * Zentrale Fabrik für externe Dienste. APP_INTEGRATIONS=mock (Standard, Previews, Tests) liefert
 * Mocks, =live die echten Anbieter. Instanzen werden je Prozess einmal erzeugt.
 */
interface Integrations {
  payments: PaymentProvider;
  email: EmailProvider;
  invoicing: InvoiceProvider;
  shipping: ShippingProvider;
}

let cached: Integrations | null = null;

export function integrations(): Integrations {
  if (cached) return cached;
  const env = serverEnv();
  if (env.APP_INTEGRATIONS === "mock") {
    cached = {
      payments: new MockPaymentProvider(),
      email: new MockEmailProvider(),
      invoicing: new MockInvoiceProvider(),
      shipping: new MockShippingProvider(),
    };
    return cached;
  }
  cached = {
    payments: new StripePaymentProvider(env.STRIPE_SECRET_KEY!, env.STRIPE_WEBHOOK_SECRET!),
    email: new ResendEmailProvider(env.RESEND_API_KEY!, {
      from: env.EMAIL_FROM_TRANSACTIONAL,
      replyTo: env.EMAIL_REPLY_TO,
      webhookSecret: env.RESEND_WEBHOOK_SECRET,
    }),
    // Lexware und DHL bleiben Mock, bis Key beziehungsweise Zugang vorliegen (Briefing 1a)
    invoicing: env.LEXWARE_API_KEY
      ? new LexwareInvoiceProvider(env.LEXWARE_API_KEY)
      : new MockInvoiceProvider(),
    shipping:
      env.DHL_API_KEY && env.DHL_USERNAME && env.DHL_PASSWORD && env.DHL_BILLING_NUMBER
        ? new DhlShippingProvider({
            apiKey: env.DHL_API_KEY,
            username: env.DHL_USERNAME,
            password: env.DHL_PASSWORD,
            billingNumber: env.DHL_BILLING_NUMBER,
            environment: env.DHL_ENVIRONMENT,
          })
        : new MockShippingProvider(),
  };
  return cached;
}
