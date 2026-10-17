/**
 * Regeln der Löschung auf Antrag (DSGVO Art. 17) aus dem Backoffice. Rein, getestet in
 * erasure.test.ts; ausgeführt von erase.ts.
 *
 * Grundsatz: Personenbezogene Daten werden gelöscht oder pseudonymisiert. Bestellungen bleiben mit
 * ihren Rechnungsdaten erhalten, weil sie Buchungsbelege sind (Aufbewahrungspflicht nach § 147 AO
 * und § 257 HGB, Art. 17 Abs. 3 lit. b DSGVO). Sie hängen danach am pseudonymisierten Kunden.
 * Was nicht für die Aufbewahrung gebraucht wird (Telefon, Kundennotiz zur Bestellung), entfällt.
 */

export const PSEUDONYM_DOMAIN = "invalid.provibe-drinks.de";
export const ERASED_NAME = "Gelöscht";
export const ERASED_TEXT = "[gelöscht auf Antrag nach Art. 17 DSGVO]";
export const ERASED_REVIEW_AUTHOR = "Ehemaliges Kundenkonto";

/** Pseudonyme Adresse, eindeutig je Datensatz, nie zustellbar (Domain invalid). */
export function pseudonymEmail(id: string): string {
  return `geloescht+${id}@${PSEUDONYM_DOMAIN}`;
}

export function isPseudonymEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${PSEUDONYM_DOMAIN}`);
}

export function emailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase() && a.trim() !== "";
}

/** Bestellstatus, bei denen die Bestellung noch bearbeitet wird. */
export const OPEN_ORDER_STATUSES = ["pending", "paid", "processing"] as const;
/** Abo-Status, die eine Löschung verhindern (wie anonymize_customer). */
export const RUNNING_SUBSCRIPTION_STATUSES = ["active", "paused", "past_due"] as const;

export interface ErasureCheckInput {
  customerEmail: string;
  confirmEmail: string;
  anonymizedAt: string | null;
  orders: { order_number: string; status: string; is_test: boolean }[];
  subscriptions: { status: string }[];
}

/**
 * Gründe, die eine Löschung jetzt verhindern. Leere Liste: Löschung erlaubt.
 * Testbestellungen zählen nicht als offen.
 */
export function erasureBlockers(input: ErasureCheckInput): string[] {
  const out: string[] = [];
  if (input.anonymizedAt) out.push("Der Kunde ist bereits gelöscht.");
  if (!emailsMatch(input.customerEmail, input.confirmEmail))
    out.push("Die eingegebene E-Mail-Adresse stimmt nicht mit dem Kunden überein.");
  if (
    input.subscriptions.some((s) =>
      (RUNNING_SUBSCRIPTION_STATUSES as readonly string[]).includes(s.status),
    )
  )
    out.push("Der Kunde hat ein laufendes Abo. Kündige es zuerst.");
  const open = input.orders.filter(
    (o) => !o.is_test && (OPEN_ORDER_STATUSES as readonly string[]).includes(o.status),
  );
  if (open.length > 0)
    out.push(
      `Offene Bestellung ${open.map((o) => o.order_number).join(", ")}: erst versenden oder stornieren, dann löschen.`,
    );
  return out;
}

export type ErasureAction = "löschen" | "pseudonymisieren" | "behalten" | "entkoppeln";

export interface ErasureRule {
  table: string;
  label: string;
  action: ErasureAction;
  detail: string;
}

/** Was mit welchen Daten passiert (Anzeige im Bestätigungsdialog und Nachweis im Protokoll). */
export const ERASURE_RULES: readonly ErasureRule[] = [
  {
    table: "customers",
    label: "Kundendatensatz",
    action: "pseudonymisieren",
    detail:
      "Name, E-Mail, Telefon, Firma, USt-IdNr. und Akquisedetails entfallen, die E-Mail wird zu geloescht+ID@invalid.",
  },
  {
    table: "auth.users",
    label: "Kundenkonto (Login)",
    action: "löschen",
    detail: "Der Login wird gelöscht, eine Anmeldung ist nicht mehr möglich.",
  },
  {
    table: "customer_addresses",
    label: "Adressbuch",
    action: "löschen",
    detail: "Alle gespeicherten Adressen.",
  },
  {
    table: "customer_payment_methods",
    label: "Gespeicherte Zahlarten",
    action: "löschen",
    detail: "Verweise auf Karten und Zahlarten bei Stripe.",
  },
  {
    table: "customer_notes",
    label: "Interne Notizen",
    action: "löschen",
    detail: "Freitext kann personenbezogene Angaben enthalten.",
  },
  {
    table: "customer_events",
    label: "Aktivitäten",
    action: "pseudonymisieren",
    detail:
      "Ereignisse bleiben als Verlauf, ihre Details (zum Beispiel alte E-Mail) werden geleert.",
  },
  {
    table: "newsletter_contacts",
    label: "Newsletter-Kontakt",
    action: "pseudonymisieren",
    detail:
      "Abgemeldet, E-Mail pseudonymisiert, Vorname, IP und Browser des Opt-in entfallen. Kein weiterer Versand.",
  },
  {
    table: "campaign_recipients",
    label: "Kampagnen-Empfänger",
    action: "pseudonymisieren",
    detail: "Kennzahlen bleiben, die Adresse wird ersetzt.",
  },
  {
    table: "automation_runs",
    label: "Automationsläufe",
    action: "pseudonymisieren",
    detail: "Adresse wird ersetzt.",
  },
  {
    table: "email_messages",
    label: "Versandprotokoll",
    action: "pseudonymisieren",
    detail:
      "Werbe- und Konto-Mails werden pseudonymisiert. Bestell- und Rechnungsmails bleiben als Nachweis.",
  },
  {
    table: "carts",
    label: "Warenkörbe",
    action: "entkoppeln",
    detail: "Kunde und E-Mail werden entfernt.",
  },
  {
    table: "checkout_sessions",
    label: "Abgebrochene Checkouts",
    action: "pseudonymisieren",
    detail: "E-Mail, Telefon und Adressen von Checkouts ohne Bestellung entfallen.",
  },
  {
    table: "orders",
    label: "Bestellungen",
    action: "behalten",
    detail:
      "Bleiben mit Rechnungsdaten wegen der Aufbewahrungspflicht (§ 147 AO, § 257 HGB). Telefon und Kundennotiz entfallen.",
  },
  {
    table: "withdrawal_requests",
    label: "Widerrufe",
    action: "behalten",
    detail: "Nachweis zur Bestellung, Aufbewahrung wie Bestellungen.",
  },
  {
    table: "discount_redemptions",
    label: "Rabatt-Einlösungen",
    action: "pseudonymisieren",
    detail: "Adresse wird ersetzt, Beträge bleiben für die Buchhaltung.",
  },
  {
    table: "reviews",
    label: "Bewertungen",
    action: "pseudonymisieren",
    detail: `Autorname wird zu „${ERASED_REVIEW_AUTHOR}“, Text und Sterne bleiben.`,
  },
  {
    table: "subscriptions",
    label: "Beendete Abos",
    action: "pseudonymisieren",
    detail: "Lieferadresse entfällt, Abo-Historie bleibt (laufende Abos verhindern die Löschung).",
  },
  {
    table: "subscription_notes",
    label: "Interne Abo-Notizen",
    action: "löschen",
    detail: "Notizen des Teams zu den Abos der Person werden gelöscht.",
  },
  {
    table: "b2b_applications",
    label: "B2B-Anträge",
    action: "pseudonymisieren",
    detail: "Freitext-Nachricht entfällt, Firmendaten bleiben als Nachweis der Freischaltung.",
  },
  {
    table: "consent_logs",
    label: "Cookie-Einwilligungen",
    action: "entkoppeln",
    detail: "Bleiben pseudonym als Nachweis, ohne Verknüpfung zum Kunden.",
  },
  {
    table: "contact_messages",
    label: "Kontaktanfragen",
    action: "pseudonymisieren",
    detail: "Name, E-Mail, Telefon und Nachricht der Anfragen mit dieser Adresse.",
  },
  {
    table: "leads",
    label: "Partneranfragen",
    action: "pseudonymisieren",
    detail: "Ansprechpartner, E-Mail, Telefon und Nachricht der Anfragen mit dieser Adresse.",
  },
];

/** Versandprotokoll: Bestell- und interne Mails bleiben (Handelsbriefe), alles andere wird ersetzt. */
export function scrubsEmailMessage(category: string): boolean {
  return category === "marketing" || category === "auth";
}

export function newsletterContactPatch(contactId: string, now: string) {
  return {
    email: pseudonymEmail(contactId),
    status: "unsubscribed" as const,
    first_name: null,
    confirm_ip: null,
    confirm_user_agent: null,
    confirm_token_hash: null,
    consent_text: null,
    tags: [] as string[],
    resend_contact_id: null,
    unsubscribe_reason: "dsgvo_loeschung",
    unsubscribed_at: now,
  };
}

export function contactMessagePatch(messageId: string) {
  return {
    name: ERASED_NAME,
    email: pseudonymEmail(messageId),
    phone: null,
    message: ERASED_TEXT,
    ip_hash: null,
    status: "archived" as const,
  };
}

export function leadPatch(leadId: string) {
  return {
    contact_name: ERASED_NAME,
    email: pseudonymEmail(leadId),
    phone: null,
    message: null,
    ip_hash: null,
    attribution: {},
  };
}

export function orderPatch() {
  return { phone: null, customer_note: null };
}

export function checkoutSessionPatch() {
  return {
    email: null,
    phone: null,
    shipping_address: null,
    billing_address: null,
  };
}
