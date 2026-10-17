import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { mockedIntegrations } from "@/lib/admin/orders/integration-mode";
import type { StoredAddress } from "@/lib/checkout/types";
import {
  getSettings,
  getSubscription,
  type AdminSubscriptionDetail,
} from "@/lib/subscriptions/admin";
import {
  discountPreview,
  paymentErrorLabel,
  resolveSubscriptionRef,
  retryPlan,
  staffNames,
  type DiscountPreview,
} from "@/lib/subscriptions/admin-queries";
import {
  addDeliveryDays,
  addDeliveryWeeks,
  berlinDay,
  formatDay,
} from "@/lib/subscriptions/schedule";
import { CANCEL_REASONS, type SubscriptionSettings } from "@/lib/subscriptions/types";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { Card, cardActionClass } from "@/components/admin/ui/Card";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { formatDate, formatDateTime, formatMoney } from "@/components/admin/ui/format";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Timeline, type TimelineItem } from "@/components/admin/ui/Timeline";
import { CanThumb } from "@/components/admin/subscriptions/CanThumb";
import {
  ACTOR_LABEL,
  CANCEL_KIND_LABEL,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  STATUS_BADGE,
  eventDisplay,
  intervalText,
  percentFromBp,
} from "@/components/admin/subscriptions/labels";
import { SubscriptionActions } from "@/components/admin/subscriptions/SubscriptionActions";
import { SubscriptionNotes } from "@/components/admin/subscriptions/SubscriptionNotes";

export const metadata: Metadata = { title: "Abo" };

const LIST = "/admin/abos";

function isAddress(value: unknown): value is StoredAddress {
  return Boolean(value && typeof value === "object" && "postal_code" in (value as object));
}

function addressLines(a: StoredAddress): string[] {
  return [
    [a.first_name, a.last_name].filter(Boolean).join(" "),
    a.company ?? "",
    [a.street, a.house_number].filter(Boolean).join(" "),
    a.address_addition ?? "",
    `${a.postal_code} ${a.city}`,
    "Deutschland",
  ].filter((s) => s.length > 0);
}

function brandLabel(brand: string | null, type: string): string {
  if (type === "paypal") return "PayPal";
  if (type === "sepa_debit") return "SEPA-Lastschrift";
  if (!brand) return "Karte";
  const map: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    maestro: "Maestro",
  };
  return map[brand.toLowerCase()] ?? brand;
}

/** Beschreibung eines Ereignisses aus seinen Daten (ohne Rohwerte wie Intent-IDs). */
function eventDescription(kind: string, data: Record<string, unknown>): string | null {
  const day = (v: unknown) => (typeof v === "string" && v ? formatDay(v) : null);
  switch (kind) {
    case "paused":
      return data.reason === "payment_failed"
        ? "Nach dem letzten Zahlungsversuch automatisch pausiert"
        : day(data.until)
          ? `Bis ${day(data.until)}`
          : null;
    case "skipped":
    case "unskipped":
      return day(data.delivery) ? `Lieferung am ${day(data.delivery)}` : null;
    case "discount_changed":
      return typeof data.from === "number" && typeof data.to === "number"
        ? `${percentFromBp(data.from)} auf ${percentFromBp(data.to)}`
        : null;
    case "payment_failed":
      return [
        typeof data.code === "string" ? paymentErrorLabel(data.code) : null,
        typeof data.attempt === "number" ? `Versuch ${data.attempt}` : null,
        day(data.next_retry_at) ? `nächster Versuch ${day(data.next_retry_at)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "cancelled":
    case "cancellation_scheduled":
      return [
        typeof data.kind === "string" ? CANCEL_KIND_LABEL[data.kind] : null,
        day(data.effective_at) ? `wirksam ${day(data.effective_at)}` : null,
        typeof data.reason === "string" ? data.reason : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "payment_method_changed":
      return typeof data.last4 === "string"
        ? `${brandLabel((data.brand as string) ?? null, String(data.type ?? "card"))} ···· ${data.last4}`
        : null;
    case "address_changed":
      return [data.postal_code, data.city].filter(Boolean).join(" ") || null;
    case "stock_missing":
      return day(data.original_date) ? `Ursprünglich ${day(data.original_date)}` : null;
    case "price_notice_sent":
      return typeof data.new_total_cents === "number" && typeof data.old_total_cents === "number"
        ? `${formatMoney(data.old_total_cents)} auf ${formatMoney(data.new_total_cents)}${day(data.effective_at) ? ` ab ${day(data.effective_at)}` : ""}`
        : null;
    case "changed": {
      const parts: string[] = [];
      const iw = data.interval_weeks as { from?: number; to?: number } | undefined;
      const qty = data.quantity as { from?: number; to?: number } | undefined;
      if (iw?.to) parts.push(`Intervall ${intervalText(iw.to)}`);
      if (qty?.to) parts.push(`Menge ${qty.to}`);
      if (data.variant_id) parts.push("Sorte oder Packgröße gewechselt");
      return parts.join(" · ") || null;
    }
    default:
      return null;
  }
}

/**
 * /admin/abos/[id] (Figma 82:2420, mobil 82:3176): Kopf mit Nummer, Status und Aktionen, Lieferplan
 * mit Preis je Lieferung, Zahlungsfehler mit Wiederholungsplan, Lieferhistorie, Ereignisse, Kunde,
 * Zahlungsmittel, Lieferadresse. [id] ist die UUID oder die Abo-Nummer (ABO-1001).
 * Fulfillment sieht Lieferplan, Adresse und Historie ohne Beträge und ohne Aktionen.
 */
export default async function AboDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: ref } = await params;
  const session = await requireStaff("support", { next: `${LIST}/${ref}` });
  const canOperate = PERMISSIONS.viewCustomers(session);
  const canManage = PERMISSIONS.editSettings(session);
  const seeMoney = PERMISSIONS.viewCustomers(session);

  let detail: AdminSubscriptionDetail | null = null;
  let settings: SubscriptionSettings | null = null;
  let preview: DiscountPreview | null = null;
  let names = new Map<string, string>();
  try {
    const row = await resolveSubscriptionRef(ref);
    if (!row) notFound();
    if (row.id !== decodeURIComponent(ref)) redirect(`${LIST}/${row.id}`);
    [detail, settings, preview, names] = await Promise.all([
      getSubscription(row.id),
      getSettings(),
      canManage ? discountPreview(row) : Promise.resolve(null),
      staffNames(),
    ]);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("[admin] Abo-Detail", error);
    return (
      <>
        <PageHeader title="Abo" backHref={LIST} backLabel="Abos" />
        <FormMessage tone="error">Das Abo konnte gerade nicht geladen werden.</FormMessage>
      </>
    );
  }
  if (!detail || !settings) notFound();
  const { row, item, snapshot } = detail;
  const now = new Date();
  const badge = STATUS_BADGE[row.status];
  const testMode = mockedIntegrations().payments;
  const plan = retryPlan(row, settings);

  // Termine
  const next = item.nextDelivery ? new Date(item.nextDelivery) : null;
  const planned = row.next_order_at ? new Date(row.next_order_at) : null;
  const afterSkip = planned ? addDeliveryWeeks(planned, row.interval_count) : null;
  const reminder =
    next && row.status === "active" ? addDeliveryDays(next, -settings.reminderDays) : null;
  const following = next
    ? [1, 2]
        .map((n) => addDeliveryWeeks(next, row.interval_count * n))
        .filter(
          (d) =>
            !row.cancel_effective_at || d.getTime() < new Date(row.cancel_effective_at).getTime(),
        )
    : [];
  const pauseMin = berlinDay(addDeliveryDays(now, 1));
  const pauseMaxDate = addDeliveryDays(now, settings.pauseMaxDays);
  const pauseDefault = berlinDay(
    addDeliveryWeeks(next && next.getTime() > now.getTime() ? next : now, 4),
  );
  const cancelScheduled =
    row.status !== "cancelled" && row.cancel_effective_at
      ? formatDay(row.cancel_effective_at)
      : null;

  const customerName = item.customerName || item.customerEmail || "Kunde";
  const summary = `${row.number} · ${customerName} · ${item.productTitle} ${item.variantTitle}${row.quantity > 1 ? ` × ${row.quantity}` : ""}`;
  const address = isAddress(row.shipping_address) ? row.shipping_address : null;
  const line = snapshot?.lines[0] ?? null;
  const listGoods = line
    ? (line.subscription?.listUnitPriceCents ?? line.unitPriceCents) * line.quantity
    : 0;
  const aboGoods = line ? line.unitPriceCents * line.quantity : 0;

  const timeline: TimelineItem[] = detail.events.map((e) => {
    const d = eventDisplay(e.kind);
    const actor =
      e.actor_type === "staff" && e.actor_id
        ? (names.get(e.actor_id) ?? "Team")
        : (ACTOR_LABEL[e.actor_type] ?? e.actor_type);
    return {
      id: e.id,
      title: d.title,
      description: eventDescription(e.kind, e.data ?? {}),
      at: e.created_at,
      icon: d.icon,
      tone: d.tone,
      actor,
    };
  });

  const schedule = (
    <Card
      title="Lieferplan"
      action={
        <span className="text-admin-text-2 text-[14px] whitespace-nowrap">
          {intervalText(row.interval_count)}
        </span>
      }
    >
      <div className="flex items-center gap-3">
        <CanThumb src={line?.imageUrl ?? item.imageUrl ?? null} size="md" />
        <div className="min-w-0">
          <p className="text-admin-akzent font-semibold">{item.productTitle || "Produkt"}</p>
          <p className="text-admin-text-2 text-[13px]">
            {(line?.description ?? item.variantTitle).split(" · im Abo")[0]} · Menge {row.quantity}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-admin-feld bg-admin-flaeche p-3">
          <dt className="text-admin-text-2 text-[12px]">Nächste Lieferung</dt>
          <dd className="text-[16px] font-semibold">
            {row.status === "past_due"
              ? "Zahlung offen"
              : next
                ? formatDay(next)
                : row.status === "cancelled"
                  ? "keine mehr"
                  : "–"}
          </dd>
          <dd className="text-admin-text-2 text-[12px]">
            {row.status === "past_due" && planned
              ? `Termin ${formatDay(planned)}, wird erneut versucht`
              : row.skip_next && planned
                ? `${formatDay(planned)} wird übersprungen`
                : row.status === "paused"
                  ? row.pause_reason === "payment_failed"
                    ? "Pausiert nach Zahlungsfehlern"
                    : "Ende der Pause"
                  : "Abbuchung am Liefertag"}
          </dd>
        </div>
        <div className="rounded-admin-feld bg-admin-flaeche p-3">
          <dt className="text-admin-text-2 text-[12px]">Erinnerung</dt>
          <dd className="text-[16px] font-semibold">{reminder ? formatDay(reminder) : "–"}</dd>
          <dd className="text-admin-text-2 text-[12px]">
            {settings.reminderDays} Tage vorher per E-Mail
          </dd>
        </div>
        <div className="rounded-admin-feld bg-admin-flaeche p-3">
          <dt className="text-admin-text-2 text-[12px]">Danach</dt>
          <dd className="text-[16px] font-semibold">
            {following.length ? following.map((d) => formatDay(d)).join(", ") : "–"}
          </dd>
          <dd className="text-admin-text-2 text-[12px]">
            {cancelScheduled ? `Vertragsende ${cancelScheduled}` : "im Rhythmus"}
          </dd>
        </div>
      </dl>
      {seeMoney && snapshot && line ? (
        <dl className="divide-admin-rahmen mt-4 divide-y text-[14px]">
          <PriceRow label="Warenwert (ohne Pfand)" value={formatMoney(listGoods)} />
          <PriceRow
            label={`Abo-Rabatt ${percentFromBp(row.discount_bp)}`}
            value={`−${formatMoney(Math.max(0, listGoods - aboGoods))}`}
          />
          <PriceRow
            label={`Pfand (${snapshot.depositCans} Dosen)`}
            value={formatMoney(snapshot.depositCents)}
          />
          <PriceRow
            label={snapshot.shipping ? `Versand (${snapshot.shipping.name})` : "Versand"}
            value={snapshot.shippingFree ? "kostenlos" : formatMoney(snapshot.shippingCents)}
          />
          <PriceRow
            label="Preis je Lieferung inkl. MwSt."
            value={formatMoney(snapshot.totalCents)}
            strong
          />
        </dl>
      ) : null}
      {seeMoney && row.price_notice_sent_at ? (
        <FormMessage tone="info" className="mt-3 mb-0">
          Preisänderung angekündigt am {formatDate(row.price_notice_sent_at)}, wirksam ab{" "}
          {formatDate(row.price_change_effective_at)}.
        </FormMessage>
      ) : null}
    </Card>
  );

  const history = (
    <Card title="Lieferhistorie" flush>
      {detail.deliveries.length === 0 && !next ? (
        <EmptyState compact icon="lkw" title="Noch keine Lieferung" />
      ) : (
        <ul className="divide-admin-rahmen border-admin-rahmen divide-y border-t">
          {next && row.status !== "cancelled" ? (
            <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[14px]">
              <span className="w-24 font-semibold">
                {row.status === "past_due" ? "offen" : "geplant"}
              </span>
              <span className="text-admin-text-2 flex-1">{formatDay(next)}</span>
              {seeMoney && snapshot ? (
                <span className="font-semibold tabular-nums">
                  {formatMoney(snapshot.totalCents)}
                </span>
              ) : null}
              {row.status === "past_due" ? (
                <Badge tone="yellow">Zahlung offen</Badge>
              ) : (
                <Badge tone="gray">Geplant</Badge>
              )}
            </li>
          ) : null}
          {detail.deliveries.map((d) => {
            const pay = PAYMENT_STATUS_LABEL[d.paymentStatus];
            return (
              <li
                key={d.orderId}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[14px]"
              >
                <Link
                  href={`/admin/bestellungen/${d.orderId}`}
                  className="text-admin-akzent w-24 font-semibold underline underline-offset-2"
                >
                  {d.orderNumber}
                </Link>
                <span className="text-admin-text-2 flex-1">
                  {formatDate(d.placedAt)} ·{" "}
                  {d.kind === "initial" ? "Erstbestellung" : "Folgelieferung"}
                </span>
                {seeMoney ? (
                  <span className="font-semibold tabular-nums">{formatMoney(d.totalCents)}</span>
                ) : null}
                <span className="flex gap-1">
                  {seeMoney && pay ? <Badge tone={pay.tone}>{pay.label}</Badge> : null}
                  <Badge tone="blue" hollow>
                    {ORDER_STATUS_LABEL[d.status] ?? d.status}
                  </Badge>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );

  const addressCard = (
    <Card title="Lieferadresse">
      {address ? (
        <address className="text-[14px] leading-[1.5] not-italic">
          {addressLines(address).map((l) => (
            <span key={l} className="block">
              {l}
            </span>
          ))}
        </address>
      ) : (
        <p className="text-admin-text-2 text-[14px]">Keine Lieferadresse hinterlegt.</p>
      )}
      <p className="text-admin-text-2 mt-2 text-[12px]">Ändern kann der Kunde im Kundenkonto.</p>
    </Card>
  );

  return (
    <>
      <PageHeader
        title={`Abo ${row.number}`}
        backHref={LIST}
        backLabel="Abos"
        meta={
          <>
            <Badge tone={badge.tone}>{badge.label}</Badge>
            {seeMoney ? <Badge tone="accent">Rabatt {percentFromBp(row.discount_bp)}</Badge> : null}
            {cancelScheduled ? (
              <Badge tone="red" hollow>
                Kündigung zum {cancelScheduled}
              </Badge>
            ) : null}
          </>
        }
        description={`seit ${formatDate(row.created_at)} · ${intervalText(row.interval_count)}${canOperate ? ` · ${customerName}` : ""}`}
      />

      <SubscriptionActions
        id={row.id}
        number={row.number}
        status={row.status}
        summary={summary}
        skipNext={row.skip_next}
        plannedLabel={planned ? formatDay(planned) : null}
        afterSkipLabel={afterSkip ? formatDay(afterSkip) : null}
        pausedUntilLabel={row.paused_until ? formatDay(row.paused_until) : null}
        pausedForPayment={row.status === "paused" && row.pause_reason === "payment_failed"}
        pause={{
          min: pauseMin,
          max: berlinDay(pauseMaxDate),
          defaultDay: pauseDefault < pauseMin ? pauseMin : pauseDefault,
          maxLabel: formatDay(pauseMaxDate),
        }}
        nextDeliveryLabel={next && next.getTime() > now.getTime() ? formatDay(next) : null}
        cancelScheduledLabel={cancelScheduled}
        canOperate={canOperate}
        canManage={canManage}
        discountBp={row.discount_bp}
        preview={preview ? { totals: preview.totals, currentBp: preview.currentBp } : null}
        reasons={CANCEL_REASONS.map((r) => ({ value: r.id, label: r.label }))}
        testMode={testMode}
      />

      {row.status === "cancelled" ? (
        <FormMessage tone="info">
          Gekündigt am {formatDateTime(row.cancelled_at)}
          {row.cancel_kind ? ` (${CANCEL_KIND_LABEL[row.cancel_kind]})` : ""}, Vertragsende{" "}
          {formatDate(row.cancel_effective_at ?? row.cancelled_at)}.
          {canOperate && row.cancel_reason ? ` Grund: ${row.cancel_reason}` : ""}
        </FormMessage>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          {schedule}
          {canOperate && plan ? (
            <Card
              title="Zahlungsfehler"
              description={
                plan.pausedAfterFailures
                  ? "Alle automatischen Versuche sind gescheitert, das Abo ist pausiert."
                  : "Die letzte Abbuchung wurde abgelehnt. Der Kunde hat eine Mail mit Link zum Zahlungsmittel bekommen."
              }
            >
              <dl className="grid grid-cols-[minmax(0,160px)_1fr] gap-x-3 gap-y-2 text-[14px]">
                <dt className="text-admin-text-2">Fehler</dt>
                <dd>{paymentErrorLabel(plan.lastError)}</dd>
                <dt className="text-admin-text-2">Offen seit</dt>
                <dd>{formatDateTime(plan.firstFailedAt)}</dd>
                <dt className="text-admin-text-2">Letzter Versuch</dt>
                <dd>
                  {formatDateTime(plan.lastFailedAt)} · {plan.failedAttempts}{" "}
                  {plan.failedAttempts === 1 ? "Fehlversuch" : "Fehlversuche"}
                </dd>
                <dt className="text-admin-text-2">Wiederholungsplan</dt>
                <dd>
                  {plan.pausedAfterFailures
                    ? "keine weiteren automatischen Versuche"
                    : plan.remaining.length
                      ? plan.remaining.map((d) => formatDay(d)).join(", ")
                      : plan.nextRetryAt
                        ? formatDay(plan.nextRetryAt)
                        : "–"}
                  <span className="text-admin-text-2 block text-[12px]">
                    Einstellung: Tag {settings.retryDays.join(" und Tag ")} nach dem ersten
                    Fehlschlag, danach Pause
                  </span>
                </dd>
                {plan.awaitingAuthentication ? (
                  <>
                    <dt className="text-admin-text-2">Bestätigung</dt>
                    <dd>Wartet auf 3-D Secure durch den Kunden (Link per Mail)</dd>
                  </>
                ) : null}
              </dl>
            </Card>
          ) : null}
          {history}
          {canOperate ? (
            <Card title="Ereignisse" description="Alle Änderungen mit Bearbeiter und Zeit">
              {timeline.length ? (
                <Timeline items={timeline} />
              ) : (
                <p className="text-admin-text-2 text-[14px]">Noch keine Ereignisse.</p>
              )}
            </Card>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {canOperate && detail.customer ? (
            <Card
              title="Kunde"
              action={
                <Link href={`/admin/kunden/${detail.customer.id}`} className={cardActionClass}>
                  Profil öffnen
                </Link>
              }
            >
              <Link
                href={`/admin/kunden/${detail.customer.id}`}
                className="text-admin-akzent font-semibold underline underline-offset-2"
              >
                {customerName}
              </Link>
              <p className="text-admin-text-2 mt-1 text-[13px] break-all">
                {detail.customer.email}
              </p>
              <p className="text-admin-text-2 mt-1 text-[13px]">
                {item.deliveries}{" "}
                {item.deliveries === 1 ? "bezahlte Lieferung" : "bezahlte Lieferungen"} ·{" "}
                {formatMoney(item.revenueCents)} Umsatz mit diesem Abo
              </p>
            </Card>
          ) : null}
          {canOperate ? <SubscriptionNotes subscriptionId={row.id} names={names} /> : null}
          {canOperate ? (
            <Card title="Zahlungsmittel">
              {detail.paymentMethod ? (
                <>
                  <p className="font-semibold">
                    {brandLabel(detail.paymentMethod.brand, detail.paymentMethod.type)}
                    {detail.paymentMethod.last4 ? ` ···· ${detail.paymentMethod.last4}` : ""}
                  </p>
                  <p className="text-admin-text-2 mt-1 text-[13px]">
                    {detail.paymentMethod.expMonth && detail.paymentMethod.expYear
                      ? `Gültig bis ${String(detail.paymentMethod.expMonth).padStart(2, "0")}/${detail.paymentMethod.expYear}`
                      : "Ohne Ablaufdatum"}
                    {testMode ? " · Testmodus" : ""}
                  </p>
                </>
              ) : (
                <p className="text-admin-text-2 text-[14px]">Kein Zahlungsmittel hinterlegt.</p>
              )}
              {item.deliveries > 0 && detail.deliveries[0] ? (
                <p className="text-admin-text-2 mt-1 text-[13px]">
                  Letzte Abbuchung {formatDate(detail.deliveries[0].placedAt)}:{" "}
                  {PAYMENT_STATUS_LABEL[detail.deliveries[0].paymentStatus]?.label ??
                    detail.deliveries[0].paymentStatus}
                </p>
              ) : null}
              <p className="text-admin-text-2 mt-2 text-[12px]">
                Ändern kann der Kunde im Kundenkonto, eine offene Zahlung wird dann sofort erneut
                versucht.
              </p>
            </Card>
          ) : null}
          {addressCard}
        </div>
      </div>
    </>
  );
}

function PriceRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className={strong ? "font-medium" : "text-admin-text-2"}>{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
