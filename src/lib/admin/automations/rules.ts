import { z } from "zod";

/**
 * Regeln der Automationen (rein, getestet in rules.test.ts):
 *   welcome         nach bestätigtem Double Opt-in, nicht für importierte Kontakte
 *   abandoned_cart  frühestens 24 Stunden nach der letzten Aktivität, nur mit Werbeeinwilligung
 *   review_request  nach Zustellung, nur mit Werbeeinwilligung (H20), standardmäßig aus
 * Werbeeinwilligung = Newsletter-Kontakt subscribed mit confirmed_at.
 */

export const AUTOMATION_KEYS = ["welcome", "abandoned_cart", "review_request"] as const;
export type AutomationKey = (typeof AUTOMATION_KEYS)[number];

export const AUTOMATION_META: Record<
  AutomationKey,
  {
    name: string;
    description: string;
    template: string;
    jobKind: string;
    consentHint: string | null;
  }
> = {
  welcome: {
    name: "Willkommen nach Opt-in",
    description: "Startet, sobald ein Kontakt den Double Opt-in bestätigt.",
    template: "newsletter_welcome",
    jobKind: "automation.welcome",
    consentHint: null,
  },
  abandoned_cart: {
    name: "Warenkorbabbrecher",
    description: "Erinnert an einen verlassenen Warenkorb.",
    template: "abandoned_cart",
    jobKind: "automation.abandoned_cart",
    consentHint:
      "Nur an Kontakte mit Werbeeinwilligung (Newsletter bestätigt), frühestens nach 24 Stunden.",
  },
  review_request: {
    name: "Bewertungsanfrage nach Zustellung",
    description: "Bittet nach der Zustellung um eine Bewertung.",
    template: "review_request",
    jobKind: "automation.review_request",
    consentHint:
      "Nur an Kontakte mit Werbeeinwilligung, bis die Bestandskundenausnahme (§ 7 Abs. 3 UWG) anwaltlich geprüft ist (H20).",
  },
};

const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

/**
 * Optionaler Rabattcode für Willkommens- und Warenkorbmail (Großbuchstaben, Ziffern, - und _).
 * Ob der Code existiert und aktiv ist, prüft automations.ts beim Speichern.
 */
export const discountCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,40}$/, "Code mit 3 bis 40 Zeichen: Buchstaben, Ziffern, - oder _.")
  .optional();

export const automationConfigSchemas = {
  welcome: z.object({
    delay_minutes: int(0, 7 * 24 * 60).default(5),
    template: z.literal("newsletter_welcome").default("newsletter_welcome"),
    discount_code: discountCodeSchema,
  }),
  abandoned_cart: z.object({
    delay_hours: int(24, 7 * 24).default(24),
    max_age_days: int(1, 30).default(7),
    requires_marketing_consent: z.literal(true).default(true),
    template: z.literal("abandoned_cart").default("abandoned_cart"),
    discount_code: discountCodeSchema,
  }),
  review_request: z.object({
    delay_days: int(1, 60).default(7),
    requires_marketing_consent: z.literal(true).default(true),
    template: z.literal("review_request").default("review_request"),
  }),
} as const;

export type WelcomeConfig = z.infer<typeof automationConfigSchemas.welcome>;
export type AbandonedCartConfig = z.infer<typeof automationConfigSchemas.abandoned_cart>;
export type ReviewRequestConfig = z.infer<typeof automationConfigSchemas.review_request>;

/** Gespeicherte Konfiguration lesen; ungültige Werte fallen auf die sicheren Standards zurück. */
export function parseAutomationConfig<K extends AutomationKey>(
  key: K,
  value: unknown,
): z.infer<(typeof automationConfigSchemas)[K]> {
  const schema = automationConfigSchemas[key] as z.ZodType;
  const parsed = schema.safeParse(value ?? {});
  if (parsed.success) return parsed.data as z.infer<(typeof automationConfigSchemas)[K]>;
  return schema.parse({}) as z.infer<(typeof automationConfigSchemas)[K]>;
}

/** Lesbare Verzögerung für die Übersicht ("sofort", "24 Stunden", "7 Tage nach Zustellung"). */
export function delayLabel(key: AutomationKey, config: Record<string, unknown>): string {
  if (key === "welcome") {
    const m = Number(config.delay_minutes ?? 0);
    if (m <= 0) return "sofort";
    return m < 60 ? `${m} Minuten` : `${Math.round(m / 60)} Stunden`;
  }
  if (key === "abandoned_cart") return `${Number(config.delay_hours ?? 24)} Stunden`;
  return `${Number(config.delay_days ?? 7)} Tage nach Zustellung`;
}

/**
 * Prüfungen der Entscheidungsfunktionen in Reihenfolge (Anzeige im Backoffice). Muss zu
 * decideWelcome, decideAbandonedCart und decideReviewRequest passen (rules.test.ts prüft die Gründe).
 */
export const AUTOMATION_CHECKS: Record<AutomationKey, string[]> = {
  welcome: [
    "Automation eingeschaltet",
    "Noch nicht an diesen Kontakt gesendet",
    "Kein importierter Kontakt (Shopify-Import bekommt keine Willkommensmail)",
    "Bestätigter Opt-in: Status abonniert mit Bestätigungszeitpunkt",
  ],
  abandoned_cart: [
    "Automation eingeschaltet",
    "Warenkorb noch nicht erinnert, aktiv und nicht bestellt",
    "E-Mail-Adresse und mindestens ein Artikel vorhanden",
    "Seit der letzten Aktivität mindestens die Verzögerung vergangen (nie unter 24 Stunden)",
    "Warenkorb nicht älter als die Höchstdauer",
    "Werbeeinwilligung: Newsletter bestätigt",
  ],
  review_request: [
    "Automation eingeschaltet, keine Testbestellung",
    "Noch nicht angefragt, Bestellung zugestellt, nicht storniert oder erstattet",
    "Verzögerung seit Zustellung abgelaufen (sonst später erneut geprüft)",
    "Werbeeinwilligung: Newsletter bestätigt (H20, bis zur anwaltlichen Freigabe)",
  ],
};

export type Decision = { send: true } | { send: false; reason: string; final: boolean };

export interface ConsentState {
  status: string | null;
  confirmed_at: string | null;
}

export function hasMarketingConsent(c: ConsentState | null): boolean {
  return Boolean(c && c.status === "subscribed" && c.confirmed_at);
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export function decideWelcome(input: {
  enabled: boolean;
  contact: (ConsentState & { source: string }) | null;
  alreadySent: boolean;
}): Decision {
  if (!input.enabled) return { send: false, reason: "Automation ausgeschaltet", final: true };
  if (input.alreadySent) return { send: false, reason: "Schon gesendet", final: true };
  if (!input.contact) return { send: false, reason: "Kontakt nicht gefunden", final: true };
  if (input.contact.source === "import_shopify")
    return { send: false, reason: "Importierter Kontakt", final: true };
  if (!hasMarketingConsent(input.contact))
    return { send: false, reason: "Kein bestätigter Opt-in", final: true };
  return { send: true };
}

export function decideAbandonedCart(input: {
  enabled: boolean;
  config: AbandonedCartConfig;
  cart: {
    status: string;
    email: string | null;
    last_activity_at: string;
    abandoned_email_sent_at: string | null;
    converted_order_id: string | null;
    item_count: number;
  } | null;
  consent: ConsentState | null;
  now: Date;
}): Decision {
  const { cart, config } = input;
  if (!input.enabled) return { send: false, reason: "Automation ausgeschaltet", final: true };
  if (!cart) return { send: false, reason: "Warenkorb nicht gefunden", final: true };
  if (cart.abandoned_email_sent_at) return { send: false, reason: "Schon erinnert", final: true };
  if (cart.status !== "active" || cart.converted_order_id)
    return { send: false, reason: "Warenkorb bestellt oder geschlossen", final: true };
  if (!cart.email) return { send: false, reason: "Keine E-Mail-Adresse", final: true };
  if (cart.item_count <= 0) return { send: false, reason: "Warenkorb leer", final: true };
  const idle = input.now.getTime() - new Date(cart.last_activity_at).getTime();
  const delay = Math.max(config.delay_hours, 24) * HOUR;
  if (idle < delay) return { send: false, reason: "Warenkorb wieder aktiv", final: true };
  if (idle > config.max_age_days * DAY)
    return { send: false, reason: "Warenkorb zu alt", final: true };
  if (!hasMarketingConsent(input.consent))
    return { send: false, reason: "Keine Werbeeinwilligung", final: true };
  return { send: true };
}

export function decideReviewRequest(input: {
  enabled: boolean;
  config: ReviewRequestConfig;
  order: {
    status: string;
    delivered_at: string | null;
    review_request_sent_at: string | null;
    is_test: boolean;
  } | null;
  consent: ConsentState | null;
  now: Date;
}): Decision {
  const { order } = input;
  if (!input.enabled) return { send: false, reason: "Automation ausgeschaltet", final: true };
  if (!order) return { send: false, reason: "Bestellung nicht gefunden", final: true };
  if (order.review_request_sent_at) return { send: false, reason: "Schon angefragt", final: true };
  if (!order.delivered_at) return { send: false, reason: "Noch nicht zugestellt", final: true };
  if (order.status === "cancelled" || order.status === "refunded")
    return { send: false, reason: "Storniert oder erstattet", final: true };
  if (input.now.getTime() - new Date(order.delivered_at).getTime() < input.config.delay_days * DAY)
    return { send: false, reason: "Noch zu früh", final: false };
  if (!hasMarketingConsent(input.consent))
    return { send: false, reason: "Keine Werbeeinwilligung (H20)", final: true };
  return { send: true };
}

/** Viertelstunden-Takt des Sweeps (Idempotenzschlüssel und nächster Lauf). */
export function sweepBucket(now: Date): { key: string; next: string } {
  const ms = 15 * 60_000;
  const start = Math.floor(now.getTime() / ms) * ms;
  return { key: new Date(start).toISOString(), next: new Date(start + ms).toISOString() };
}
