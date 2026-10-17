import "server-only";
import { integrations } from "@/lib/integrations";

/**
 * Welche externen Dienste antworten gerade als Mock? Die Bestellseiten zeigen dann "Testmodus"
 * an Zahlung, Label, Rechnung und Mails (Briefing: Mocks bis die Keys vorliegen).
 */
export interface IntegrationModes {
  payments: boolean;
  email: boolean;
  invoicing: boolean;
  shipping: boolean;
}

export function mockedIntegrations(): IntegrationModes {
  const i = integrations();
  return {
    payments: i.payments.name === "mock",
    email: i.email.name === "mock",
    invoicing: i.invoicing.name === "mock",
    shipping: i.shipping.name === "mock",
  };
}
