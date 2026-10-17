import type { OrderDetailEvent } from "@/lib/admin/orders/read";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/admin/orders/status";
import { Badge, type BadgeTone } from "@/components/admin/ui/Badge";
import type { IconName } from "@/components/admin/ui/Icon";
import { Timeline, type TimelineItem } from "@/components/admin/ui/Timeline";

/**
 * Verlauf aus order_events (Figma Karte "Verlauf"): Statuswechsel mit Badge, Mails, Zahlungen,
 * Sendungen, Erstattungen, Rechnungen, Adressänderungen. Neueste zuerst. Ereignisse ohne Akteur
 * kommen vom System (Checkout, Jobs, Webhooks).
 */

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  pending: "yellow",
  paid: "green",
  processing: "yellow",
  shipped: "blue",
  delivered: "green",
  cancelled: "red",
  refunded: "red",
  partially_refunded: "yellow",
};

const KIND: Record<string, { icon: IconName; tone: TimelineItem["tone"] }> = {
  created: { icon: "bestellungen", tone: "accent" },
  paid: { icon: "karte", tone: "green" },
  payment_succeeded: { icon: "karte", tone: "green" },
  email_sent: { icon: "emails", tone: "default" },
  invoice_created: { icon: "pdf", tone: "default" },
  label_created: { icon: "lkw", tone: "default" },
  shipment: { icon: "lkw", tone: "accent" },
  refund: { icon: "erstatten", tone: "red" },
  refund_failed: { icon: "warnung", tone: "red" },
  restock: { icon: "bestand", tone: "default" },
  address_changed: { icon: "ort", tone: "default" },
  note: { icon: "notiz", tone: "default" },
};

/** Ereignisse, die Fulfillment nicht sieht (Beträge, Erstattungen). */
export const MONEY_EVENT_KINDS = new Set(["refund", "refund_failed", "paid", "payment_succeeded"]);

export function OrderTimeline({ events }: { events: OrderDetailEvent[] }) {
  const items: TimelineItem[] = events.map((e) => {
    const to = e.kind === "status_changed" ? (e.data.to as OrderStatus | undefined) : undefined;
    const map = KIND[e.kind] ?? { icon: "liste" as IconName, tone: "default" as const };
    return {
      id: e.id,
      icon: e.kind === "status_changed" ? "liste" : map.icon,
      tone: to ? (to === "cancelled" || to === "refunded" ? "red" : "accent") : map.tone,
      title: (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>{e.message ?? e.kind}</span>
          {to && ORDER_STATUS_LABELS[to] ? (
            <Badge tone={STATUS_TONE[to]} hollow={to === "pending"}>
              {ORDER_STATUS_LABELS[to]}
            </Badge>
          ) : null}
          {e.visibleToCustomer ? (
            <span className="text-admin-text-2 text-[12px]">im Kundenkonto sichtbar</span>
          ) : null}
        </span>
      ),
      description: typeof e.data.reason === "string" ? `Grund: ${e.data.reason}` : undefined,
      at: e.createdAt,
      actor: e.actorName ?? "System",
    };
  });
  return <Timeline items={items} />;
}
