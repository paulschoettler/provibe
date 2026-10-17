import type { OrderDetail } from "@/lib/admin/orders/read";
import { Badge } from "@/components/admin/ui/Badge";
import { formatMoney } from "@/components/admin/ui/format";
import { Icon } from "@/components/admin/ui/Icon";

/**
 * Positionen einer Bestellung (Figma 35:12228, Karte "Positionen"). Pfand getrennt vom Preis (H22):
 * Hauptpreis ohne Pfand, darunter "zzgl. … Pfand". order_items.unit_price_cents ist bereits ohne
 * Pfand gespeichert, unit_deposit_cents getrennt. showTotals false für Fulfillment (keine Beträge
 * jenseits der Positionen).
 */
export function OrderItems({ order, showTotals }: { order: OrderDetail; showTotals: boolean }) {
  const a = order.amounts;
  return (
    <>
      <ul className="flex flex-col">
        {order.items.map((item) => {
          const perCan =
            item.unitDepositCents > 0 && item.unitCount > 0
              ? Math.round(item.unitDepositCents / item.unitCount)
              : 0;
          const cans = item.quantity * item.unitCount;
          return (
            <li
              key={item.id}
              className="border-admin-rahmen flex gap-3 border-b py-3 first:pt-0 last:border-b-0"
            >
              <span className="rounded-admin-feld border-admin-rahmen bg-admin-flaeche flex size-14 shrink-0 items-center justify-center overflow-hidden border">
                {item.imagePath ? (
                  // Statische Produktbilder aus /public, keine Optimierung nötig
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imagePath} alt="" className="size-full object-cover" />
                ) : (
                  <Icon name="produkte" size={20} className="text-admin-text-2" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between md:gap-4">
                  <div className="min-w-0">
                    <p className="text-admin-akzent text-[15px] font-medium">
                      {item.productId ? (
                        <a href={`/admin/produkte/${item.productId}`} className="hover:underline">
                          {item.title}
                        </a>
                      ) : (
                        item.title
                      )}
                    </p>
                    <p className="text-admin-text-2 text-[13px]">
                      {[item.variantTitle, item.sku ? `SKU ${item.sku}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {item.basePriceText ? (
                      <p className="text-admin-text-2 text-[13px]">{item.basePriceText}</p>
                    ) : null}
                    {item.unitDepositCents > 0 ? (
                      <p className="text-admin-text-2 flex items-center gap-1 text-[13px]">
                        <Icon name="info" size={14} />
                        zzgl. {formatMoney(item.quantity * item.unitDepositCents)} Pfand
                        {perCan > 0 ? ` (${cans} × ${formatMoney(perCan)})` : ""}
                      </p>
                    ) : null}
                    {item.components?.length ? (
                      <ul className="text-admin-text-2 mt-1 list-disc pl-4 text-[13px]">
                        {item.components.map((c) => (
                          <li key={c.variant_id}>
                            {item.quantity * c.quantity} × {c.title}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {item.refundedQuantity > 0 ? (
                        <Badge tone="red" hollow>
                          {item.refundedQuantity} erstattet
                        </Badge>
                      ) : null}
                      {item.fulfilledQuantity > 0 && item.fulfilledQuantity >= item.quantity ? (
                        <Badge tone="blue">versendet</Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-6 text-[14px] md:justify-end">
                    <span className="text-admin-text-2 tabular-nums">
                      {item.quantity} × {formatMoney(item.unitPriceCents)}
                    </span>
                    <span className="w-20 text-right font-semibold tabular-nums">
                      {formatMoney(item.quantity * item.unitPriceCents)}
                    </span>
                  </div>
                </div>
                {item.discountCents > 0 ? (
                  <p className="text-admin-text-2 mt-0.5 text-right text-[13px] tabular-nums">
                    davon Rabatt −{formatMoney(item.discountCents)}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {order.customerNote ? (
        <p className="rounded-admin-feld bg-admin-gelb-hell mt-3 p-3 text-[13px]">
          <span className="font-semibold">Hinweis des Kunden:</span> {order.customerNote}
        </p>
      ) : null}

      {showTotals ? (
        <dl className="border-admin-rahmen mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-t pt-3 text-[14px]">
          <dt className="text-admin-text-2">Zwischensumme (ohne Pfand)</dt>
          <dd className="text-right tabular-nums">{formatMoney(a.subtotalCents)}</dd>
          {a.discountCents > 0 ? (
            <>
              <dt className="text-admin-text-2">
                Rabatt{a.discountCode ? ` (${a.discountCode})` : ""}
              </dt>
              <dd className="text-right tabular-nums">−{formatMoney(a.discountCents)}</dd>
            </>
          ) : null}
          {a.depositCents > 0 ? (
            <>
              <dt className="text-admin-text-2">Pfand</dt>
              <dd className="text-right tabular-nums">{formatMoney(a.depositCents)}</dd>
            </>
          ) : null}
          <dt className="text-admin-text-2">
            Versand{a.shippingName ? ` (${a.shippingName})` : ""}
          </dt>
          <dd className="text-right tabular-nums">{formatMoney(a.shippingCents)}</dd>
          <dt className="border-admin-rahmen border-t pt-2 font-semibold">Gesamt</dt>
          <dd className="border-admin-rahmen border-t pt-2 text-right font-semibold tabular-nums">
            {formatMoney(a.totalCents)}
          </dd>
          {a.taxLines.map((t) => (
            <div key={t.rateBp} className="contents">
              <dt className="text-admin-text-2 text-[13px]">
                inkl. {(t.rateBp / 100).toLocaleString("de-DE")} % MwSt.
              </dt>
              <dd className="text-admin-text-2 text-right text-[13px] tabular-nums">
                {formatMoney(t.taxCents)}
              </dd>
            </div>
          ))}
          {a.refundedCents > 0 ? (
            <>
              <dt className="text-admin-rot">Erstattet</dt>
              <dd className="text-admin-rot text-right tabular-nums">
                −{formatMoney(a.refundedCents)}
              </dd>
              <dt className="font-medium">Verbleibend</dt>
              <dd className="text-right font-medium tabular-nums">
                {formatMoney(a.refundableCents)}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </>
  );
}
