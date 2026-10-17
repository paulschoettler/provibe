/**
 * Reine Abbildungen fürs Kundenprofil (Kennzahlen, Opt-in-Nachweis, Kontostatus, Tags, Timeline).
 * Keine Datenbank, getestet in profile.test.ts.
 */

export interface KpiOrder {
  orderNumber: string;
  placedAt: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  isTest: boolean;
}

export interface CustomerKpis {
  totalSpentCents: number;
  ordersCount: number;
  averageOrderCents: number;
  cancelledCount: number;
  firstOrder: { at: string; orderNumber: string | null } | null;
  lastOrder: { at: string; orderNumber: string | null } | null;
}

const COUNTED_PAYMENT = new Set(["paid", "partially_refunded"]);

/**
 * Kennzahlen aus den gepflegten Spalten (refresh_customer_stats) mit Bestellnummern aus der Liste.
 * Ø Bestellwert = Umsatz / Anzahl gezählter Bestellungen, kaufmännisch gerundet.
 */
export function customerKpis(
  customer: {
    orders_count: number;
    total_spent_cents: number;
    first_order_at: string | null;
    last_order_at: string | null;
  },
  orders: KpiOrder[],
): CustomerKpis {
  const counted = orders
    .filter((o) => !o.isTest && COUNTED_PAYMENT.has(o.paymentStatus) && o.status !== "cancelled")
    .sort((a, b) => a.placedAt.localeCompare(b.placedAt));
  const total = Number(customer.total_spent_cents) || 0;
  const count = customer.orders_count || 0;
  const first = counted[0];
  const last = counted[counted.length - 1];
  return {
    totalSpentCents: total,
    ordersCount: count,
    averageOrderCents: count > 0 ? Math.round(total / count) : 0,
    cancelledCount: orders.filter((o) => !o.isTest && o.status === "cancelled").length,
    firstOrder: customer.first_order_at
      ? { at: customer.first_order_at, orderNumber: first?.orderNumber ?? null }
      : null,
    lastOrder: customer.last_order_at
      ? { at: customer.last_order_at, orderNumber: last?.orderNumber ?? null }
      : null,
  };
}

export interface NewsletterContactRow {
  id: string;
  email: string;
  status: "pending" | "subscribed" | "unsubscribed" | "bounced" | "complained";
  source: string;
  opt_in_sent_at: string | null;
  confirmed_at: string | null;
  confirm_ip: unknown;
  confirm_user_agent: string | null;
  consent_text: string | null;
  consent_version: string | null;
  imported_consent_at: string | null;
  unsubscribed_at: string | null;
  unsubscribe_reason: string | null;
  created_at: string;
}

export type OptInKind = "double_opt_in" | "shopify_import" | "pending" | "none";

export interface OptInProof {
  status: NewsletterContactRow["status"] | "none";
  statusLabel: string;
  kind: OptInKind;
  /** Versandfähig: subscribed mit Bestätigungszeitpunkt */
  sendable: boolean;
  source: string | null;
  sourceLabel: string | null;
  requestedAt: string | null;
  confirmedAt: string | null;
  ip: string | null;
  userAgent: string | null;
  consentText: string | null;
  consentVersion: string | null;
  importedConsentAt: string | null;
  unsubscribedAt: string | null;
  unsubscribeReason: string | null;
  /** Kurzer Hinweis für die Anzeige, z.B. "Shopify-Import, Nachweis nur mit Zeitstempel" */
  note: string;
}

export const NEWSLETTER_STATUS_LABEL: Record<NewsletterContactRow["status"] | "none", string> = {
  subscribed: "Abonniert",
  pending: "Unbestätigt",
  unsubscribed: "Abgemeldet",
  bounced: "Unzustellbar",
  complained: "Beschwerde",
  none: "Kein Kontakt",
};

export const NEWSLETTER_SOURCE_LABEL: Record<string, string> = {
  footer: "Footer",
  checkout: "Checkout",
  import_shopify: "Shopify-Import",
  admin: "Backoffice",
  popup: "Pop-up",
  account: "Kundenkonto",
};

/** Opt-in-Nachweis aus newsletter_contacts (DSGVO Art. 7 Abs. 1). */
export function optInProof(contact: NewsletterContactRow | null): OptInProof {
  if (!contact) {
    return {
      status: "none",
      statusLabel: NEWSLETTER_STATUS_LABEL.none,
      kind: "none",
      sendable: false,
      source: null,
      sourceLabel: null,
      requestedAt: null,
      confirmedAt: null,
      ip: null,
      userAgent: null,
      consentText: null,
      consentVersion: null,
      importedConsentAt: null,
      unsubscribedAt: null,
      unsubscribeReason: null,
      note: "Keine Newsletter-Anmeldung.",
    };
  }
  const imported = contact.source === "import_shopify" || Boolean(contact.imported_consent_at);
  const hasDoi = Boolean(contact.confirmed_at && contact.confirm_ip);
  let kind: OptInKind;
  let note: string;
  if (hasDoi) {
    kind = "double_opt_in";
    note = `Double Opt-in bestätigt${contact.consent_version ? `, Einwilligungstext Version ${contact.consent_version}` : ""}.`;
  } else if (imported && contact.imported_consent_at) {
    kind = "shopify_import";
    note = "Shopify-Import, Nachweis nur mit Zeitstempel (keine IP, kein Einwilligungstext).";
  } else if (contact.status === "pending" || contact.opt_in_sent_at) {
    kind = "pending";
    note = "Bestätigung ausstehend, kein Versand.";
  } else {
    kind = contact.confirmed_at ? "double_opt_in" : "none";
    note = contact.confirmed_at ? "Bestätigt ohne gespeicherte IP." : "Kein Nachweis vorhanden.";
  }
  const sendable = contact.status === "subscribed" && Boolean(contact.confirmed_at);
  return {
    status: contact.status,
    statusLabel: NEWSLETTER_STATUS_LABEL[contact.status],
    kind,
    sendable,
    source: contact.source,
    sourceLabel: NEWSLETTER_SOURCE_LABEL[contact.source] ?? contact.source,
    requestedAt: contact.opt_in_sent_at,
    confirmedAt: contact.confirmed_at,
    ip: contact.confirm_ip ? String(contact.confirm_ip) : null,
    userAgent: contact.confirm_user_agent,
    consentText: contact.consent_text,
    consentVersion: contact.consent_version,
    importedConsentAt: contact.imported_consent_at,
    unsubscribedAt: contact.unsubscribed_at,
    unsubscribeReason: contact.unsubscribe_reason,
    note,
  };
}

export type AccountStatus = "anonymized" | "blocked" | "active" | "not_activated";

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  anonymized: "gelöscht (pseudonymisiert)",
  blocked: "gesperrt",
  active: "aktiv",
  not_activated: "nicht aktiviert",
};

export function accountStatus(c: {
  anonymized_at: string | null;
  blocked_at: string | null;
  auth_user_id: string | null;
}): AccountStatus {
  if (c.anonymized_at) return "anonymized";
  if (c.blocked_at) return "blocked";
  return c.auth_user_id ? "active" : "not_activated";
}

/** Tags bereinigen: trimmen, Leerraum zusammenziehen, max. 40 Zeichen, eindeutig (ohne Groß/klein), max. 30. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!tag) continue;
    const key = tag.toLocaleLowerCase("de-DE");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= 30) break;
  }
  return out;
}

export function displayName(c: {
  first_name: string | null;
  last_name: string | null;
  company_name?: string | null;
  email: string;
}): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name || c.company_name || c.email;
}

export function initials(name: string): string {
  const parts = name
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/* ----------------------------------------------------------------------------------------- */
/* Timeline                                                                                   */
/* ----------------------------------------------------------------------------------------- */

export type TimelineSource = "customer" | "order" | "newsletter" | "note" | "email";

export interface TimelineEntry {
  id: string;
  at: string;
  source: TimelineSource;
  kind: string;
  title: string;
  detail: string | null;
  /** Verknüpfung, z.B. Bestell-ID für den Link ins Bestelldetail */
  orderId?: string | null;
}

const CUSTOMER_EVENT_TITLES: Record<string, string> = {
  auth_linked: "Kundenkonto verknüpft",
  guest_orders_claimed: "Gastbestellungen zugeordnet",
  customer_merged: "Kundendatensätze zusammengeführt",
  email_changed: "E-Mail-Adresse geändert",
  email_change_conflict: "E-Mail-Wechsel abgelehnt (Adresse vergeben)",
  account_deleted: "Konto gelöscht",
  tags_changed: "Tags geändert",
  activation_sent: "Aktivierungslink gesendet",
  blocked: "Kunde gesperrt",
  unblocked: "Sperre aufgehoben",
  automation_sent: "Automation gesendet",
  lead_converted: "Aus Lead als B2B-Kunde übernommen",
  newsletter_admin_unsubscribe: "Newsletter im Backoffice abgemeldet",
};

const ORDER_EVENT_TITLES: Record<string, string> = {
  status_changed: "Status geändert",
  paid: "Zahlung eingegangen",
  email_sent: "E-Mail gesendet",
  invoice_created: "Rechnung erstellt",
  refund: "Erstattung",
  note: "Notiz",
  shipment: "Sendung",
  created: "Bestellung aufgegeben",
  order_created: "Bestellung aufgegeben",
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function customerEventDetail(kind: string, data: Record<string, unknown>): string | null {
  switch (kind) {
    case "guest_orders_claimed":
      return typeof data.count === "number" ? `${data.count} Bestellung(en)` : null;
    case "email_changed":
      return data.old && data.new ? `${String(data.old)} → ${String(data.new)}` : null;
    case "tags_changed":
      return Array.isArray(data.tags) ? data.tags.join(", ") || "keine Tags" : null;
    case "blocked":
      return typeof data.reason === "string" ? data.reason : null;
    case "automation_sent":
      return typeof data.automation === "string" ? data.automation : null;
    default:
      return typeof data.message === "string" ? data.message : null;
  }
}

export function buildTimeline(input: {
  customerEvents: { id: number | string; kind: string; data: unknown; created_at: string }[];
  orderEvents: {
    id: number | string;
    order_id: string;
    order_number: string | null;
    kind: string;
    message: string | null;
    created_at: string;
  }[];
  orders?: {
    id: string;
    order_number: string;
    placed_at: string;
    total_cents: number;
    payment_label?: string | null;
  }[];
  newsletter: NewsletterContactRow | null;
  notes: { id: string; body: string; author: string | null; created_at: string }[];
  emails?: {
    id: string;
    subject: string;
    template: string;
    status: string;
    to_email: string;
    created_at: string;
    order_id: string | null;
  }[];
  limit?: number;
}): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const e of input.customerEvents) {
    out.push({
      id: `ce:${e.id}`,
      at: e.created_at,
      source: "customer",
      kind: e.kind,
      title: CUSTOMER_EVENT_TITLES[e.kind] ?? e.kind,
      detail: customerEventDetail(e.kind, record(e.data)),
    });
  }
  for (const o of input.orders ?? []) {
    out.push({
      id: `o:${o.id}`,
      at: o.placed_at,
      source: "order",
      kind: "order_placed",
      title: `Bestellung ${o.order_number} aufgegeben`,
      detail: null,
      orderId: o.id,
    });
  }
  // E-Mails, die schon als order_event "email_sent" vorliegen, nicht doppelt zeigen
  const orderMailKeys = new Set<string>();
  for (const e of input.orderEvents) {
    if (e.kind === "created" || e.kind === "order_created") continue;
    const prefix = e.order_number ? `${e.order_number}: ` : "";
    if (e.kind === "email_sent") orderMailKeys.add(`${e.order_id}|${e.created_at.slice(0, 16)}`);
    out.push({
      id: `oe:${e.id}`,
      at: e.created_at,
      source: "order",
      kind: e.kind,
      title: `${prefix}${ORDER_EVENT_TITLES[e.kind] ?? e.kind}`,
      detail: e.message,
      orderId: e.order_id,
    });
  }
  for (const m of input.emails ?? []) {
    if (m.order_id && orderMailKeys.has(`${m.order_id}|${m.created_at.slice(0, 16)}`)) continue;
    out.push({
      id: `em:${m.id}`,
      at: m.created_at,
      source: "email",
      kind: `email_${m.status}`,
      title: `E-Mail: ${m.subject}`,
      detail: `${m.template} an ${m.to_email} (${m.status})`,
      orderId: m.order_id,
    });
  }
  const n = input.newsletter;
  if (n) {
    if (n.imported_consent_at)
      out.push({
        id: `nl:import:${n.id}`,
        at: n.imported_consent_at,
        source: "newsletter",
        kind: "newsletter_imported",
        title: "Newsletter-Einwilligung (Shopify-Import)",
        detail: "Nachweis nur mit Zeitstempel",
      });
    if (n.opt_in_sent_at)
      out.push({
        id: `nl:req:${n.id}`,
        at: n.opt_in_sent_at,
        source: "newsletter",
        kind: "newsletter_requested",
        title: "Newsletter-Anmeldung angefordert",
        detail: NEWSLETTER_SOURCE_LABEL[n.source] ?? n.source,
      });
    if (n.confirmed_at && n.source !== "import_shopify")
      out.push({
        id: `nl:conf:${n.id}`,
        at: n.confirmed_at,
        source: "newsletter",
        kind: "newsletter_confirmed",
        title: "Newsletter bestätigt",
        detail: [
          "Double Opt-in",
          n.confirm_ip ? `IP ${String(n.confirm_ip)}` : null,
          n.consent_version ? `Einwilligungstext Version ${n.consent_version}` : null,
        ]
          .filter(Boolean)
          .join(", "),
      });
    if (n.unsubscribed_at)
      out.push({
        id: `nl:unsub:${n.id}`,
        at: n.unsubscribed_at,
        source: "newsletter",
        kind: "newsletter_unsubscribed",
        title:
          n.status === "bounced"
            ? "Newsletter gesperrt (unzustellbar)"
            : n.status === "complained"
              ? "Newsletter gesperrt (Beschwerde)"
              : "Newsletter abgemeldet",
        detail: n.unsubscribe_reason,
      });
  }
  for (const note of input.notes) {
    out.push({
      id: `note:${note.id}`,
      at: note.created_at,
      source: "note",
      kind: "note",
      title: `Notiz von ${note.author ?? "PROVIBE Team"}`,
      detail: note.body,
    });
  }
  out.sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : b.at.localeCompare(a.at)));
  return out.slice(0, input.limit ?? 200);
}
