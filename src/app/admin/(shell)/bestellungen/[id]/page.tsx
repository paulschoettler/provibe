import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { CARRIERS } from "@/lib/admin/fulfilment/tracking";
import { DHL_PRODUCTS, suggestedParcelWeightGrams } from "@/lib/admin/fulfilment/shipments";
import {
  addNoteAction,
  addShipmentAction,
  cancelOrderAction,
  createLabelAction,
  ensureInvoiceAction,
  markPaidAction,
  resendMailAction,
  transitionAction,
  updateAddressAction,
} from "@/lib/admin/orders/actions";
import { canEditAddress } from "@/lib/admin/orders/address";
import { mockedIntegrations } from "@/lib/admin/orders/integration-mode";
import { getOrder, type OrderDetail } from "@/lib/admin/orders/read";
import { canResend, RESEND_KINDS, type ResendKind } from "@/lib/admin/orders/resend";
import {
  MANUAL_PAYMENT_PROVIDER,
  pathToShipped,
  type OrderStatus,
} from "@/lib/admin/orders/status";
import { canSetStatus } from "@/lib/admin/orders/transition";
import { formatAddressLines } from "@/lib/checkout/snapshot";
import type { StoredAddress } from "@/lib/checkout/types";
import { AddressEditor } from "@/components/admin/orders/AddressFields";
import { DerivedBadge } from "@/components/admin/orders/OrderBadges";
import { OrderItems } from "@/components/admin/orders/OrderItems";
import { MONEY_EVENT_KINDS, OrderTimeline } from "@/components/admin/orders/OrderTimeline";
import { RefundDialog } from "@/components/admin/orders/RefundDialog";
import { ActionForm, ActionFormMessage, FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { buttonClasses } from "@/components/admin/ui/Button";
import { Card, cardActionClass } from "@/components/admin/ui/Card";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Checkbox, Field, RadioCards, Select, Textarea } from "@/components/admin/ui/fields";
import { formatDateTime, formatMoney } from "@/components/admin/ui/format";
import { Icon } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";

const LIST = "/admin/bestellungen";

const SOURCE_LABELS: Record<string, string> = {
  web: "Onlineshop",
  admin: "Manuell (Backoffice)",
  shopify_import: "Shopify-Import",
  subscription: "Abo",
};

/** Beschriftung der Statusknöpfe (Ziele aus allowedTransitions, transition.ts) */
const TRANSITION_LABELS: Partial<Record<OrderStatus, string>> = {
  paid: "Zahlungseingang verbuchen",
  processing: "In Bearbeitung setzen",
  shipped: "Versendet (ohne Tracking)",
  delivered: "Als zugestellt markieren",
};

const CANCEL_REASONS = [
  { value: "customer", label: "Kunde hat storniert" },
  { value: "payment", label: "Zahlung nicht eingegangen" },
  { value: "stock", label: "Ware nicht lieferbar" },
  { value: "fraud", label: "Verdacht auf Betrug" },
  { value: "test", label: "Testbestellung" },
  { value: "other", label: "Anderer Grund" },
];

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function AddressBlock({ label, address }: { label: string; address: StoredAddress | null }) {
  return (
    <div className="flex gap-3">
      <span className="text-admin-text-2 mt-0.5">
        <Icon name="ort" size={18} />
      </span>
      <div className="min-w-0 text-[14px] leading-[1.5]">
        <p className="text-admin-text-2">{label}</p>
        {address ? (
          formatAddressLines(address).map((line, i) => <p key={i}>{line}</p>)
        ) : (
          <p>Wie Lieferadresse</p>
        )}
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Bestellung ${/^PV-\d+$/i.test(id) ? id.toUpperCase() : ""}`.trim() };
}

/**
 * /admin/bestellungen/[id] (Figma 35:12228: Desktop 35:12498, mobil 35:12229, Erstattung
 * 35:13250). id als UUID oder Bestellnummer. Aktionen nur, wenn transition.ts und die Rolle sie
 * erlauben. Fulfillment sieht Positionen, Lieferadresse und Versand, aber keine Summen, keine
 * Zahlung, keine Erstattung und keine Kundendaten.
 */
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `${LIST}/${id}`;
  const session = await requireStaff("support", { next: path });
  let order: OrderDetail | null = null;
  try {
    order = await getOrder(decodeURIComponent(id), session);
  } catch (error) {
    console.error("[admin] Bestelldetail", error);
    return (
      <FormMessage tone="error">Die Bestellung konnte gerade nicht geladen werden.</FormMessage>
    );
  }
  if (!order) notFound();

  const seeCustomer = PERMISSIONS.viewCustomers(session);
  const seeMoney = seeCustomer;
  const canFulfil = PERMISSIONS.fulfil(session);
  const canRefund = PERMISSIONS.refund(session);
  const mocks = mockedIntegrations();
  const manual = order.payment.provider === MANUAL_PAYMENT_PROVIDER;
  const testPayment =
    order.isTest ||
    order.payment.provider === "mock" ||
    Boolean(order.payment.intentId?.includes("_mock_"));

  const outbound = order.shipments.filter((s) => !s.isReturn && s.status !== "cancelled");
  const hasShipped = outbound.some((s) => Boolean(s.shippedAt) || s.status !== "label_created");
  const shipSteps = pathToShipped(order.status, {
    paymentProvider: order.payment.provider,
    paymentStatus: order.paymentStatus,
  });
  const canShip = canFulfil && shipSteps !== null && shipSteps.length > 0;
  const transitions = order.allowedTransitions.filter(
    (to) => to !== "cancelled" && canSetStatus(session, to) && TRANSITION_LABELS[to],
  );
  const canCancel =
    order.allowedTransitions.includes("cancelled") && canSetStatus(session, "cancelled");
  const refundable =
    canRefund &&
    ["paid", "partially_refunded"].includes(order.paymentStatus) &&
    order.amounts.refundableCents > 0;
  const editAddress = seeCustomer && canEditAddress(order.status, hasShipped);
  const weightGrams = canShip ? await suggestedParcelWeightGrams(order.id) : 500;
  const resendOptions = (Object.keys(RESEND_KINDS) as ResendKind[])
    .filter((k) => canResend(session, k))
    .filter((k) =>
      k === "shipping_confirmation"
        ? outbound.some((s) => s.trackingNumber && s.status !== "label_created")
        : k === "refund_confirmation"
          ? order.refunds.some((r) => r.status === "succeeded" || r.status === "pending")
          : true,
    );
  const events = seeMoney
    ? order.events
    : order.events.filter((e) => !MONEY_EVENT_KINDS.has(e.kind));
  const placed = `${formatDateTime(order.placedAt)} Uhr · ${SOURCE_LABELS[order.source] ?? order.source}`;

  return (
    <>
      <PageHeader
        title={`Bestellung ${order.orderNumber}`}
        backHref={LIST}
        backLabel="Zurück zu den Bestellungen"
        description={
          <span className="flex flex-wrap items-center gap-2">
            {seeMoney ? <DerivedBadge badge={order.badges.payment} /> : null}
            <DerivedBadge badge={order.badges.fulfilment} />
            {order.badges.test ? (
              <Badge tone="gray" noDot>
                Test
              </Badge>
            ) : null}
            <span>{placed}</span>
          </span>
        }
      />

      {order.isTest ? (
        <FormMessage tone="warning">
          Testbestellung (is_test): taucht nur im Tab &quot;Test&quot; auf und wird vor dem Go-live
          entfernt.
        </FormMessage>
      ) : null}
      {order.cancelledAt ? (
        <FormMessage tone="info">
          Storniert am {formatDateTime(order.cancelledAt)}
          {order.cancelReason ? `: ${order.cancelReason}` : ""}
          {order.badges.payment.key === "refund_due"
            ? ". Die Zahlung ist noch nicht erstattet."
            : ""}
        </FormMessage>
      ) : null}

      <div className="mb-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-start md:justify-between">
        <div className="flex flex-wrap gap-2">
          {seeCustomer ? (
            order.invoice.hasPdf ? (
              <a
                href={`${path}/rechnung`}
                target="_blank"
                rel="noopener"
                className={buttonClasses("secondary", "md")}
              >
                <Icon name="pdf" size={16} />
                Rechnung PDF{order.invoice.isDraftPdf ? " (Entwurf)" : ""}
              </a>
            ) : (
              <ActionForm action={ensureInvoiceAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <SubmitButton variant="secondary" icon="pdf" pendingLabel="Wird erzeugt …">
                  Rechnung erzeugen
                </SubmitButton>
              </ActionForm>
            )
          ) : null}
          <a
            href={`${path}/lieferschein`}
            target="_blank"
            rel="noopener"
            className={buttonClasses("secondary", "md")}
          >
            <Icon name="pdf" size={16} />
            Lieferschein
          </a>
          {resendOptions.length > 0 ? (
            <Dialog
              title="Mail erneut senden"
              description={`Bestellung ${order.orderNumber}${seeCustomer ? ` · an ${order.email}` : ""}`}
              trigger={{ label: "Mail erneut senden", icon: "emails" }}
            >
              <ActionForm action={resendMailAction} closeDialogOnSuccess hideMessage>
                <input type="hidden" name="orderId" value={order.id} />
                <DialogBody>
                  <ActionFormMessage />
                  <RadioCards
                    name="kind"
                    legend="Welche Mail?"
                    defaultValue={resendOptions[0]}
                    options={resendOptions.map((k) => ({ value: k, label: RESEND_KINDS[k] }))}
                  />
                  <p className="text-admin-text-2 text-[13px]">
                    {mocks.email
                      ? "Testmodus: Die Mail geht an den Mock-Anbieter und erscheint im Verlauf."
                      : "Bis zum Go-live gehen Mails nur an Adressen auf der Allowlist."}
                  </p>
                </DialogBody>
                <DialogFooter>
                  <DialogClose />
                  <SubmitButton icon="emails">Senden</SubmitButton>
                </DialogFooter>
              </ActionForm>
            </Dialog>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {transitions.map((to) =>
            to === "paid" && manual ? (
              <Dialog
                key={to}
                title="Zahlungseingang verbuchen"
                description={`Bestellung ${order.orderNumber}, ${formatMoney(order.amounts.totalCents)}`}
                trigger={{ label: TRANSITION_LABELS.paid!, icon: "haken" }}
              >
                <ActionForm action={markPaidAction} closeDialogOnSuccess hideMessage>
                  <input type="hidden" name="orderId" value={order.id} />
                  <DialogBody>
                    <ActionFormMessage />
                    <Field
                      name="note"
                      label="Notiz (optional)"
                      placeholder="zum Beispiel Überweisung vom 17.10."
                      maxLength={300}
                    />
                  </DialogBody>
                  <DialogFooter>
                    <DialogClose />
                    <SubmitButton icon="haken">Als bezahlt markieren</SubmitButton>
                  </DialogFooter>
                </ActionForm>
              </Dialog>
            ) : (
              <ActionForm key={to} action={transitionAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="to" value={to} />
                <SubmitButton variant="secondary" pendingLabel="Wird gespeichert …">
                  {TRANSITION_LABELS[to]}
                </SubmitButton>
              </ActionForm>
            ),
          )}
          {refundable ? (
            <RefundDialog
              orderId={order.id}
              orderNumber={order.orderNumber}
              paymentLabel={order.payment.label}
              manual={manual}
              testMode={testPayment || mocks.payments}
              items={order.items.map((i) => ({
                id: i.id,
                title: i.title,
                variantTitle: i.variantTitle,
                unitCount: i.unitCount,
                quantity: i.quantity,
                refundedQuantity: i.refundedQuantity,
                unitPriceCents: i.unitPriceCents,
                unitDepositCents: i.unitDepositCents,
                discountCents: i.discountCents,
              }))}
              totalCents={order.amounts.totalCents}
              refundedCents={order.amounts.refundedCents}
              shippingCents={order.amounts.shippingCents}
              refundableShippingCents={order.amounts.refundableShippingCents}
              shippingName={order.amounts.shippingName}
            />
          ) : null}
          {canCancel ? (
            <Dialog
              title="Bestellung stornieren"
              description={`Bestellung ${order.orderNumber}`}
              trigger={{ label: "Stornieren", icon: "stornieren", variant: "danger" }}
            >
              <ActionForm action={cancelOrderAction} closeDialogOnSuccess hideMessage>
                <input type="hidden" name="orderId" value={order.id} />
                <DialogBody>
                  <ActionFormMessage />
                  <Select
                    name="reasonKey"
                    label="Grund"
                    placeholder="Bitte wählen"
                    options={CANCEL_REASONS}
                    required
                  />
                  <Textarea
                    name="reasonText"
                    label="Beschreibung (bei anderem Grund Pflicht)"
                    rows={2}
                  />
                  <Checkbox
                    name="restock"
                    label="Bestand zurückbuchen"
                    defaultChecked
                    description="Noch nicht versendete Ware geht zurück in den Bestand."
                  />
                  {seeMoney && ["paid", "partially_refunded"].includes(order.paymentStatus) ? (
                    <FormMessage tone="warning" className="mb-0">
                      Die Bestellung ist bezahlt. Das Storno erstattet kein Geld; erstatte danach
                      über &quot;Erstatten&quot;.
                    </FormMessage>
                  ) : null}
                </DialogBody>
                <DialogFooter>
                  <DialogClose>Abbrechen</DialogClose>
                  <SubmitButton variant="danger" icon="stornieren" pendingLabel="Wird storniert …">
                    Jetzt stornieren
                  </SubmitButton>
                </DialogFooter>
              </ActionForm>
            </Dialog>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 max-lg:contents lg:col-span-2">
          <Card title="Positionen" action={<DerivedBadge badge={order.badges.fulfilment} />}>
            <OrderItems order={order} showTotals={seeMoney} />
          </Card>

          <Card title="Versand" action={<DerivedBadge badge={order.badges.fulfilment} />}>
            <div className="flex items-start gap-3">
              <span className="rounded-admin-feld bg-admin-flaeche flex size-10 shrink-0 items-center justify-center">
                <Icon name="lkw" size={18} />
              </span>
              <div className="min-w-0 text-[14px]">
                <p className="font-medium">
                  {order.amounts.shippingName ?? "Versand"} · Deutschland
                </p>
                <p className="text-admin-text-2 text-[13px]">
                  {outbound.length === 0
                    ? "Noch keine Sendung"
                    : `${outbound.length} ${outbound.length === 1 ? "Sendung" : "Sendungen"}`}
                  {order.shippedAt ? ` · versendet ${formatDateTime(order.shippedAt)}` : ""}
                  {order.deliveredAt ? ` · zugestellt ${formatDateTime(order.deliveredAt)}` : ""}
                </p>
              </div>
            </div>

            {order.shipments.length > 0 ? (
              <ul className="border-admin-rahmen mt-3 flex flex-col border-t">
                {order.shipments.map((s) => (
                  <li
                    key={s.id}
                    className="border-admin-rahmen flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-2.5 text-[14px]"
                  >
                    <span className="font-medium">{s.carrierLabel}</span>
                    {s.trackingNumber ? (
                      s.trackingUrl ? (
                        <a
                          href={s.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-admin-akzent font-mono text-[13px] hover:underline"
                        >
                          {s.trackingNumber}
                        </a>
                      ) : (
                        <span className="font-mono text-[13px]">{s.trackingNumber}</span>
                      )
                    ) : null}
                    <Badge
                      tone={
                        s.status === "cancelled"
                          ? "gray"
                          : s.status === "delivered"
                            ? "green"
                            : s.status === "label_created"
                              ? "yellow"
                              : "blue"
                      }
                      hollow={s.status === "label_created"}
                    >
                      {s.status === "label_created"
                        ? "Label erstellt"
                        : s.status === "delivered"
                          ? "Zugestellt"
                          : s.status === "cancelled"
                            ? "Abgebrochen"
                            : s.isReturn
                              ? "Retoure"
                              : "Versendet"}
                    </Badge>
                    {s.hasLabel && canFulfil ? (
                      <a
                        href={`${path}/label/${s.id}`}
                        target="_blank"
                        rel="noopener"
                        className={cardActionClass}
                      >
                        Label öffnen{mocks.shipping ? " (Testmodus)" : ""}
                      </a>
                    ) : null}
                    <span className="text-admin-text-2 w-full text-[12px]">
                      {formatDateTime(s.shippedAt ?? s.createdAt)}
                      {s.createdByName ? ` · ${s.createdByName}` : ""}
                      {s.customerNotifiedAt
                        ? ` · Versandmail ${formatDateTime(s.customerNotifiedAt)}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {canShip ? (
              <div className="mt-4 flex flex-col gap-3">
                <ActionForm action={addShipmentAction} className="flex flex-col gap-3">
                  <input type="hidden" name="orderId" value={order.id} />
                  <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                    <Select
                      name="carrier"
                      label="Versanddienst"
                      defaultValue="dhl"
                      options={Object.entries(CARRIERS).map(([value, label]) => ({
                        value,
                        label,
                      }))}
                    />
                    <Field
                      name="trackingNumber"
                      label="Trackingnummer"
                      autoComplete="off"
                      placeholder="zum Beispiel 00340434161094000000"
                      defaultValue={
                        outbound.find((s) => s.status === "label_created")?.trackingNumber ?? ""
                      }
                      hint="Versandmail geht automatisch raus, sobald du speicherst."
                    />
                  </div>
                  <Checkbox
                    name="notify"
                    label="Kunden per Versandmail informieren"
                    defaultChecked
                  />
                  <div className="flex flex-wrap gap-2">
                    <SubmitButton icon="haken" pendingLabel="Wird gespeichert …">
                      Tracking speichern
                    </SubmitButton>
                  </div>
                </ActionForm>
                <div className="flex flex-wrap gap-2">
                  <Dialog
                    title="DHL-Label erstellen"
                    description={`Bestellung ${order.orderNumber}${mocks.shipping ? " · Testmodus (Mock, kein echtes Label)" : ""}`}
                    trigger={{ label: "DHL-Label erstellen", icon: "lkw" }}
                  >
                    <ActionForm action={createLabelAction} closeDialogOnSuccess hideMessage>
                      <input type="hidden" name="orderId" value={order.id} />
                      <DialogBody>
                        <ActionFormMessage />
                        <RadioCards
                          name="product"
                          legend="Produkt"
                          defaultValue="V01PAK"
                          options={Object.entries(DHL_PRODUCTS).map(([value, label]) => ({
                            value,
                            label,
                          }))}
                        />
                        <Field
                          name="weightKg"
                          label="Paketgewicht"
                          suffix="kg"
                          inputMode="decimal"
                          defaultValue={(weightGrams / 1000).toLocaleString("de-DE", {
                            maximumFractionDigits: 3,
                          })}
                          hint="Vorschlag aus den Positionen. Bitte nach dem Wiegen anpassen."
                        />
                        <Checkbox name="withReturnLabel" label="Retourenlabel beilegen" />
                        <p className="text-admin-text-2 text-[13px]">
                          Die Bestellung geht auf &quot;In Bearbeitung&quot;. Versendet ist sie,
                          sobald du die Sendungsnummer mit &quot;Tracking speichern&quot;
                          bestätigst.
                        </p>
                      </DialogBody>
                      <DialogFooter>
                        <DialogClose />
                        <SubmitButton icon="lkw" pendingLabel="Wird erstellt …">
                          Label erstellen
                        </SubmitButton>
                      </DialogFooter>
                    </ActionForm>
                  </Dialog>
                </div>
              </div>
            ) : null}
          </Card>

          {seeMoney ? (
            <Card
              title="Zahlung"
              action={
                <span className="flex items-center gap-2">
                  {testPayment || (mocks.payments && !manual) ? (
                    <Badge tone="gray" noDot>
                      Testmodus
                    </Badge>
                  ) : null}
                  <DerivedBadge badge={order.badges.payment} />
                </span>
              }
            >
              <div className="flex items-start gap-3">
                <span className="rounded-admin-feld bg-admin-flaeche flex size-10 shrink-0 items-center justify-center">
                  <Icon name="karte" size={18} />
                </span>
                <div className="min-w-0 flex-1 text-[14px]">
                  <p className="font-medium">{order.payment.label}</p>
                  <p className="text-admin-text-2 text-[13px] break-all">
                    {manual
                      ? "Zahlung per Rechnung, Eingang wird von Hand verbucht"
                      : order.payment.intentId
                        ? `Zahlungsreferenz ${order.payment.intentId}`
                        : "Keine Zahlungsreferenz"}
                  </p>
                </div>
                {order.payment.dashboardUrl ? (
                  <a
                    href={order.payment.dashboardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${cardActionClass} flex items-center gap-1`}
                  >
                    <Icon name="extern" size={16} />
                    In Stripe öffnen
                  </a>
                ) : null}
              </div>
              <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-2 text-[14px]">
                <dt className="text-admin-text-2">Betrag</dt>
                <dd className="font-semibold tabular-nums">
                  {formatMoney(order.payment.amountCents)}
                </dd>
                <dt className="text-admin-text-2">Zeitpunkt</dt>
                <dd>
                  {order.payment.paidAt
                    ? `${formatDateTime(order.payment.paidAt)} Uhr`
                    : "noch nicht bezahlt"}
                </dd>
                <dt className="text-admin-text-2">Rechnung</dt>
                <dd>
                  {order.invoice.number
                    ? `Nr. ${order.invoice.number}`
                    : order.invoice.status === "draft"
                      ? `Entwurf ohne Nummer${mocks.invoicing ? " (Testmodus)" : ""}`
                      : order.invoice.status === "failed"
                        ? "fehlgeschlagen"
                        : "noch keine"}
                  {order.invoice.error ? (
                    <span className="text-admin-rot block text-[12px]">{order.invoice.error}</span>
                  ) : null}
                </dd>
                <dt className="text-admin-text-2">Erstattungen</dt>
                <dd>
                  {order.refunds.length === 0 ? (
                    "Keine Erstattungen"
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {order.refunds.map((r) => (
                        <li key={r.id}>
                          <span className="font-medium tabular-nums">
                            {formatMoney(r.amountCents)}
                          </span>{" "}
                          <Badge
                            tone={
                              r.status === "succeeded"
                                ? "green"
                                : r.status === "failed"
                                  ? "red"
                                  : "yellow"
                            }
                            noDot
                          >
                            {r.status === "succeeded"
                              ? "erfolgreich"
                              : r.status === "failed"
                                ? "fehlgeschlagen"
                                : r.status === "pending"
                                  ? "in Bearbeitung"
                                  : r.status}
                          </Badge>
                          <span className="text-admin-text-2 block text-[12px]">
                            {formatDateTime(r.createdAt)}
                            {r.createdByName ? ` · ${r.createdByName}` : ""}
                            {r.reason ? ` · ${r.reason}` : ""}
                            {r.restock ? " · Bestand zurückgebucht" : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </dl>
            </Card>
          ) : null}

          <Card
            className="max-lg:order-last"
            title="Verlauf"
            description="Statuswechsel, Mails und Aktionen mit Benutzer und Zeit"
          >
            {events.length > 0 ? (
              <OrderTimeline events={events} />
            ) : (
              <EmptyState compact icon="protokoll" title="Noch keine Ereignisse" />
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4 max-lg:contents">
          {seeCustomer ? (
            <Card
              title="Kunde"
              action={
                order.customer ? (
                  <Link href={`/admin/kunden/${order.customer.id}`} className={cardActionClass}>
                    Profil öffnen
                  </Link>
                ) : null
              }
            >
              {order.customer ? (
                <div className="flex items-start gap-3">
                  <span className="bg-admin-akzent-hell text-admin-akzent flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold">
                    {initials(order.customer.name)}
                  </span>
                  <div className="min-w-0 text-[14px]">
                    <Link
                      href={`/admin/kunden/${order.customer.id}`}
                      className="text-admin-akzent font-medium underline underline-offset-2"
                    >
                      {order.customer.name}
                    </Link>
                    <p className="text-admin-text-2 text-[13px]">
                      {order.customer.ordersCount}{" "}
                      {order.customer.ordersCount === 1 ? "Bestellung" : "Bestellungen"} ·{" "}
                      {formatMoney(order.customer.totalSpentCents)} Umsatz gesamt
                    </p>
                    <p className="mt-1 break-all">
                      <a href={`mailto:${order.email}`} className="hover:underline">
                        {order.email}
                      </a>
                    </p>
                    {(order.phone ?? order.customer.phone) ? (
                      <p className="text-admin-text-2">{order.phone ?? order.customer.phone}</p>
                    ) : null}
                    {order.customer.tags.length > 0 ? (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {order.customer.tags.map((t) => (
                          <Badge key={t} tone="gray" noDot>
                            {t}
                          </Badge>
                        ))}
                      </p>
                    ) : null}
                    {!order.customer.hasAccount ? (
                      <p className="text-admin-text-2 mt-1 text-[12px]">Gast ohne Kundenkonto</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-[14px] break-all">{order.email}</p>
              )}
            </Card>
          ) : null}

          <Card
            title={seeCustomer ? "Adressen" : "Lieferadresse"}
            action={
              editAddress ? (
                <Dialog
                  title="Adressen bearbeiten"
                  description="Nur bis zum Versand möglich. Die Änderung landet im Protokoll."
                  trigger={{ label: "Bearbeiten", variant: "text" }}
                  size="lg"
                >
                  <ActionForm
                    action={updateAddressAction}
                    closeDialogOnSuccess
                    hideMessage
                    resetOnSuccess={false}
                  >
                    <input type="hidden" name="orderId" value={order.id} />
                    <DialogBody>
                      <ActionFormMessage />
                      <AddressEditor
                        shipping={order.shippingAddress}
                        billing={order.billingAddress}
                      />
                    </DialogBody>
                    <DialogFooter>
                      <DialogClose />
                      <SubmitButton pendingLabel="Wird gespeichert …">Speichern</SubmitButton>
                    </DialogFooter>
                  </ActionForm>
                </Dialog>
              ) : null
            }
          >
            <div className="flex flex-col gap-4">
              <AddressBlock label="Lieferadresse" address={order.shippingAddress} />
              {seeCustomer ? (
                <AddressBlock label="Rechnungsadresse" address={order.billingAddress} />
              ) : null}
              {seeCustomer && !editAddress && hasShipped ? (
                <p className="text-admin-text-2 text-[12px]">
                  Versendet: Die Adresse ist nicht mehr änderbar.
                </p>
              ) : null}
            </div>
          </Card>

          <Card
            title="Interne Notizen"
            action={
              <Badge tone="gray" noDot>
                Nur intern
              </Badge>
            }
          >
            <ActionForm action={addNoteAction} className="flex flex-col gap-2">
              <input type="hidden" name="orderId" value={order.id} />
              <Textarea
                name="text"
                label="Notiz"
                hideLabel
                rows={3}
                maxLength={5000}
                placeholder="Notiz hinzufügen, zum Beispiel Absprachen mit dem Kunden"
              />
              <div className="flex justify-end">
                <SubmitButton variant="secondary" pendingLabel="Wird gespeichert …">
                  Notiz speichern
                </SubmitButton>
              </div>
            </ActionForm>
            {order.notes.length > 0 ? (
              <ul className="border-admin-rahmen mt-3 flex flex-col gap-3 border-t pt-3">
                {order.notes.map((n) => (
                  <li key={n.id} className="text-[14px]">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="text-admin-text-2 mt-0.5 text-[12px]">
                      {formatDateTime(n.createdAt)} · {n.authorName ?? "System"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          {seeCustomer && order.legalVersions.length > 0 ? (
            <Card title="Rechtstexte" description="Fassung zum Zeitpunkt der Bestellung">
              <ul className="flex flex-col gap-1 text-[14px]">
                {order.legalVersions.map((l) => (
                  <li key={l.id}>
                    {l.title} <span className="text-admin-text-2">Version {l.version}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
      {!seeMoney ? (
        <p className="text-admin-text-2 mt-4 text-[12px]">
          Deine Rolle sieht Positionen, Lieferadresse und Versand, aber keine Zahlungs-,
          Erstattungs- und Kundendaten.
        </p>
      ) : null}
    </>
  );
}
