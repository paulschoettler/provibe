import type { OrderBadges as Badges } from "@/lib/admin/orders/status";
import { Badge } from "@/components/admin/ui/Badge";

/** Zahl- und Versandstatus (H16, abgeleitet) plus Test-Badge, wie in Figma Bestellliste 35:4502. */
export function OrderBadges({
  badges,
  only,
  withTest = true,
}: {
  badges: Badges;
  only?: "payment" | "fulfilment";
  withTest?: boolean;
}) {
  const list = only ? [badges[only]] : [badges.payment, badges.fulfilment];
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {list.map((b, i) => (
        <Badge key={`${b.key}-${i}`} tone={b.tone} hollow={b.hollow}>
          {b.label}
        </Badge>
      ))}
      {withTest && badges.test ? (
        <Badge tone="gray" noDot>
          {badges.test.label}
        </Badge>
      ) : null}
    </span>
  );
}

/** Einzelnes abgeleitetes Badge (Zahlung oder Versand). */
export function DerivedBadge({ badge }: { badge: Badges["payment"] }) {
  return (
    <Badge tone={badge.tone} hollow={badge.hollow}>
      {badge.label}
    </Badge>
  );
}
