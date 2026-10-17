/**
 * Abbildung der Resend-Webhook-Ereignisse (email.sent, email.delivered, email.opened, email.clicked,
 * email.bounced, email.complained, email.delivery_delayed, email.failed) auf unser Datenmodell.
 * Rein, getestet in resend-events.test.ts.
 */

export type ResendEventKind =
  "sent" | "delivered" | "delayed" | "opened" | "clicked" | "bounced" | "complained" | "failed";

export interface MappedResendEvent {
  kind: ResendEventKind;
  messageId: string;
  at: string;
  recipients: string[];
  /** Harter Bounce (dauerhaft): sperrt die Adresse. Weiche Bounces sperren nicht. */
  permanentBounce: boolean;
}

const KIND_BY_TYPE: Record<string, ResendEventKind> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
};

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function mapResendEvent(event: {
  type: string;
  data: unknown;
  created_at?: unknown;
}): MappedResendEvent | null {
  const kind = KIND_BY_TYPE[event.type];
  if (!kind) return null;
  const data = rec(event.data);
  const messageId = typeof data.email_id === "string" ? data.email_id : null;
  if (!messageId) return null;
  const toRaw = data.to;
  const recipients = (Array.isArray(toRaw) ? toRaw : typeof toRaw === "string" ? [toRaw] : [])
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim().toLowerCase());
  const atRaw = typeof event.created_at === "string" ? event.created_at : data.created_at;
  const at =
    typeof atRaw === "string" && !Number.isNaN(Date.parse(atRaw))
      ? new Date(atRaw).toISOString()
      : new Date().toISOString();
  const bounce = rec(data.bounce);
  const bounceType = String(bounce.type ?? "").toLowerCase();
  const permanentBounce =
    kind === "bounced" && bounceType !== "transient" && bounceType !== "temporary";
  return { kind, messageId, at, recipients, permanentBounce };
}

export type MessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed"
  | "suppressed"
  | "blocked_allowlist";

const RANK: Record<MessageStatus, number> = {
  queued: 0,
  blocked_allowlist: 0,
  suppressed: 0,
  sent: 1,
  delivered: 2,
  failed: 3,
  bounced: 4,
  complained: 5,
};

/**
 * Neuer Status einer Nachricht nach einem Ereignis. Status gehen nie zurück (Ereignisse kommen
 * nicht garantiert in Reihenfolge). Öffnen/Klicken belegen die Zustellung.
 */
export function nextMessageStatus(
  current: MessageStatus,
  kind: ResendEventKind,
  permanentBounce = true,
): MessageStatus {
  let target: MessageStatus | null = null;
  switch (kind) {
    case "sent":
      target = "sent";
      break;
    case "delivered":
    case "opened":
    case "clicked":
      target = "delivered";
      break;
    case "bounced":
      target = permanentBounce ? "bounced" : null;
      break;
    case "complained":
      target = "complained";
      break;
    case "failed":
      target = "failed";
      break;
    case "delayed":
      target = null;
  }
  if (!target) return current;
  return RANK[target] > RANK[current] ? target : current;
}

/** Zeitstempel-Felder, die ein Ereignis setzt (nur wenn noch leer). */
export function timestampFields(
  kind: ResendEventKind,
): ("delivered_at" | "opened_at" | "clicked_at" | "bounced_at" | "complained_at")[] {
  switch (kind) {
    case "delivered":
      return ["delivered_at"];
    case "opened":
      return ["delivered_at", "opened_at"];
    case "clicked":
      return ["delivered_at", "opened_at", "clicked_at"];
    case "bounced":
      return ["bounced_at"];
    case "complained":
      return ["complained_at"];
    default:
      return [];
  }
}

export interface RecipientStatRow {
  status: MessageStatus;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  unsubscribed_at: string | null;
}

export interface CampaignStats {
  recipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  blocked: number;
  failed: number;
  queued: number;
  /** Raten in Prozent (ganzzahlig gerundet) bezogen auf zugestellte Mails */
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

export function aggregateRecipientStats(rows: RecipientStatRow[]): CampaignStats {
  const s = {
    recipients: rows.length,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    complained: 0,
    unsubscribed: 0,
    blocked: 0,
    failed: 0,
    queued: 0,
  };
  for (const r of rows) {
    if (r.status === "queued") s.queued++;
    else if (r.status === "blocked_allowlist" || r.status === "suppressed") s.blocked++;
    else if (r.status === "failed") s.failed++;
    else s.sent++;
    if (r.delivered_at || r.status === "delivered" || r.opened_at || r.clicked_at) s.delivered++;
    if (r.opened_at || r.clicked_at) s.opened++;
    if (r.clicked_at) s.clicked++;
    if (r.bounced_at || r.status === "bounced") s.bounced++;
    if (r.complained_at || r.status === "complained") s.complained++;
    if (r.unsubscribed_at) s.unsubscribed++;
  }
  return {
    ...s,
    openRate: pct(s.opened, s.delivered),
    clickRate: pct(s.clicked, s.delivered),
    bounceRate: pct(s.bounced, s.sent),
  };
}
