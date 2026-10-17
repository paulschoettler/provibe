import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { CardIcon, ChevronLeftIcon, PinIcon } from "@/components/account/icons";
import { BTN_OUTLINE, Eyebrow, LINK_PLUM, Notice } from "@/components/account/ui";
import { SubmitButton } from "@/components/account/SubmitButton";
import { AboDialog } from "@/components/subscriptions/AboDialog";
import { ConfirmPaymentLive, StripeSetupForm } from "@/components/subscriptions/LivePayment";
import {
  CanImage,
  SectionCard,
  StatusBadge,
  packLabel,
} from "@/components/subscriptions/PortalParts";
import {
  AddressForm,
  CancelForm,
  MockPaymentMethodForm,
  PauseForm,
  PlanForm,
} from "@/components/subscriptions/PortalForms";
import { requireCustomer } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import { formatAddressLines } from "@/lib/checkout/snapshot";
import { formatEur } from "@/lib/money";
import { confirmPaymentFormAction, resumeAction, skipAction } from "@/lib/subscriptions/actions";
import { aboTitle } from "@/lib/subscriptions/catalog";
import { getMySubscription, type SubscriptionDetailView } from "@/lib/subscriptions/data";
import {
  addDeliveryDays,
  berlinDay,
  effectiveNextDelivery,
  formatDay,
  nextOrderAfterSkip,
  pauseSuggestions,
  resumeNextOrderAt,
} from "@/lib/subscriptions/schedule";

/**
 * /account/abo/[id]: Abo-Detail (Figma 66:627 mobil, 66:1168 Desktop), Zustand "Zahlung
 * fehlgeschlagen" (66:893 / 66:1461), Dialoge Pausieren (68:1101 / 68:1464) und Kündigen
 * (68:1287 / 68:1678). Dialoge öffnen über ?dialog=..., damit alles ohne JavaScript geht;
 * Links aus den Mails (?aktion=ueberspringen, ?aktion=pausieren) landen im passenden Dialog.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abo verwalten",
  robots: { index: false, follow: false },
};

type DialogKey =
  "pausieren" | "kuendigen" | "adresse" | "zahlungsmittel" | "ueberspringen" | "fortsetzen";
const DIALOGS: DialogKey[] = [
  "pausieren",
  "kuendigen",
  "adresse",
  "zahlungsmittel",
  "ueberspringen",
  "fortsetzen",
];

const HINTS: Record<string, { tone: "success" | "error" | "info"; text: string }> = {
  gespeichert: {
    tone: "success",
    text: "Deine Änderungen sind gespeichert. Sie gelten ab der nächsten Lieferung.",
  },
  uebersprungen: { tone: "success", text: "Die nächste Lieferung ist übersprungen." },
  "nicht-uebersprungen": {
    tone: "success",
    text: "Alles klar, die nächste Lieferung kommt wie geplant.",
  },
  pausiert: {
    tone: "success",
    text: "Dein Abo ist pausiert. Wir liefern erst wieder am angezeigten Tag.",
  },
  fortgesetzt: { tone: "success", text: "Dein Abo läuft wieder." },
  gekuendigt: {
    tone: "success",
    text: "Dein Abo ist gekündigt. Die Bestätigung kommt per E-Mail.",
  },
  adresse: { tone: "success", text: "Die Lieferadresse ist gespeichert." },
  zahlungsmittel: { tone: "success", text: "Dein Zahlungsmittel ist gespeichert." },
  bezahlt: { tone: "success", text: "Zahlung erfolgreich. Deine Lieferung ist unterwegs." },
  bestaetigt: {
    tone: "success",
    text: "Danke, deine Bank hat bestätigt. Die Lieferung erscheint gleich in der Historie.",
  },
  "zahlung-abgelehnt": {
    tone: "error",
    text: "Die Zahlung wurde leider wieder abgelehnt. Bitte hinterleg ein anderes Zahlungsmittel.",
  },
  "bestaetigung-noetig": {
    tone: "info",
    text: 'Deine Bank möchte die Zahlung bestätigen. Tipp unten auf "Zahlung bestätigen".',
  },
  fehler: { tone: "error", text: "Das hat leider nicht geklappt. Bitte versuch es noch einmal." },
};

export default async function AboDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dialog?: string; aktion?: string; hinweis?: string; fehler?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const customer = await requireCustomer(`/account/abo/${id}`);
  const view = await getMySubscription(customer, id);
  if (!view) notFound();

  const base = `/account/abo/${id}`;
  const requested = (query.dialog ?? query.aktion ?? "") as DialogKey;
  const dialog = DIALOGS.includes(requested) ? requested : null;
  const hint = query.hinweis ? HINTS[query.hinweis] : null;
  const mode = serverEnv().APP_INTEGRATIONS;
  const { row, card } = view;
  const paymentOpen =
    row.status === "past_due" || (row.status === "paused" && row.pause_reason === "payment_failed");
  const needsConfirmation = row.status === "past_due" && Boolean(row.pending_payment_intent_id);
  const editable = row.status !== "cancelled";

  return (
    <AccountShell active="abo">
      <Link
        href={"/account/abo" as Route}
        className={`${LINK_PLUM} inline-flex min-h-11 items-center gap-1 text-[14px]`}
      >
        <ChevronLeftIcon className="size-4" />
        Alle Abos
      </Link>
      <Eyebrow className="mt-2">Abo seit {formatDay(row.created_at)}</Eyebrow>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="headline text-pv-wildberry text-[44px] leading-none lg:text-[64px]">
          {card.productTitle}
        </h1>
        <StatusBadge status={row.status} />
      </div>
      <p className="text-pv-wildberry mt-2 text-[13px]">Abo-Nummer {row.number}</p>

      <div className="mt-6 flex flex-col gap-3" aria-live="polite">
        {hint ? (
          <Notice tone={hint.tone} role={hint.tone === "error" ? "alert" : "status"}>
            {hint.text}
          </Notice>
        ) : null}
        {query.fehler ? (
          <Notice tone="error" role="alert" title="Das hat nicht geklappt">
            {query.fehler.slice(0, 200)}
          </Notice>
        ) : null}
        {view.pendingIncrease && row.price_change_effective_at ? (
          <Notice tone="info" title="Preisänderung angekündigt">
            Ab {formatDay(row.price_change_effective_at)} gilt ein neuer Preis. Die Mail dazu hast
            du bekommen. Bis dahin kannst du jederzeit kündigen.
          </Notice>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-5">
          {paymentOpen ? (
            <PaymentProblem
              view={view}
              base={base}
              mode={mode}
              needsConfirmation={needsConfirmation}
            />
          ) : null}
          <DeliveryCard view={view} base={base} />
          {editable ? (
            <PlanForm
              subscriptionId={row.id}
              flavors={view.flavors.map((f) => ({
                id: f.id,
                title: aboTitle(f.handle, f.title),
                handle: f.handle,
                imageUrl: f.imageUrl,
              }))}
              currentProductId={view.currentProductId}
              packs={view.packs}
              currentUnitCount={
                view.packs.find((p) => p.variantId === row.variant_id)?.unitCount ?? 9
              }
              intervals={
                view.settings.intervals.includes(row.interval_count)
                  ? view.settings.intervals
                  : [...view.settings.intervals, row.interval_count].sort((a, b) => a - b)
              }
              currentInterval={row.interval_count}
              discountBp={row.discount_bp}
            />
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <SectionCard
            id="zahlungsmittel"
            title="Zahlungsmittel"
            action={
              editable ? (
                <Link
                  href={`${base}?dialog=zahlungsmittel` as Route}
                  scroll={false}
                  className={`${LINK_PLUM} text-[14px]`}
                >
                  Ändern<span className="sr-only"> (Zahlungsmittel)</span>
                </Link>
              ) : null
            }
          >
            <div className="flex items-start gap-3">
              <span className="bg-pv-white flex size-10 shrink-0 items-center justify-center rounded-[10px]">
                <CardIcon className="size-5" />
              </span>
              <div className="text-[14px] leading-[1.45]">
                <p className="text-[15px] font-bold">{view.paymentLabel}</p>
                {paymentOpen && row.last_payment_failed_at ? (
                  <p className="text-pv-wildberry text-[13px] font-bold">
                    Abgelehnt am {formatDay(row.last_payment_failed_at)}
                  </p>
                ) : view.paymentMethod?.exp_month && view.paymentMethod.exp_year ? (
                  <p className="text-pv-wildberry text-[13px]">
                    Gültig bis {String(view.paymentMethod.exp_month).padStart(2, "0")}/
                    {view.paymentMethod.exp_year} · gespeichert für dein Abo
                  </p>
                ) : (
                  <p className="text-pv-wildberry text-[13px]">gespeichert für dein Abo</p>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="lieferadresse"
            title="Lieferadresse"
            action={
              editable ? (
                <Link
                  href={`${base}?dialog=adresse` as Route}
                  scroll={false}
                  className={`${LINK_PLUM} text-[14px]`}
                >
                  Ändern<span className="sr-only"> (Lieferadresse)</span>
                </Link>
              ) : null
            }
          >
            <div className="flex items-start gap-3 text-[14px] leading-[1.5]">
              <PinIcon className="mt-0.5 size-5 shrink-0" />
              <address className="not-italic">
                {view.address
                  ? formatAddressLines(view.address).map((l) => (
                      <span key={l} className="block">
                        {l}
                      </span>
                    ))
                  : "Keine Adresse hinterlegt"}
              </address>
            </div>
          </SectionCard>

          <SectionCard id="lieferhistorie" title="Lieferhistorie">
            <ul className="flex flex-col">
              {upcoming(view) ? (
                <li className="border-pv-ui-hairline flex items-start justify-between gap-3 border-t py-3 text-[14px]">
                  <span>
                    <span className="block font-bold">{upcoming(view)}</span>
                    <span className="text-pv-wildberry text-[13px]">
                      {paymentOpen ? "offen" : "geplant"} · {formatEur(card.totalCents)}
                    </span>
                  </span>
                  <span
                    className={`text-[13px] font-bold ${paymentOpen ? "text-pv-wildberry" : ""}`}
                  >
                    {paymentOpen ? "Zahlung offen" : "Geplant"}
                  </span>
                </li>
              ) : null}
              {view.history.map((h) => (
                <li
                  key={h.orderNumber}
                  className="border-pv-ui-hairline flex items-start justify-between gap-3 border-t py-3 text-[14px]"
                >
                  <span>
                    <span className="block font-bold">{formatDay(h.placedAt)}</span>
                    <Link
                      href={`/account/bestellungen/${encodeURIComponent(h.orderNumber)}` as Route}
                      className="text-pv-wildberry text-[13px] underline underline-offset-2"
                    >
                      {h.orderNumber} · {formatEur(h.totalCents)}
                    </Link>
                  </span>
                  <span className="text-[13px] font-bold">
                    {ORDER_STATUS[h.status] ?? h.status}
                  </span>
                </li>
              ))}
              {view.history.length === 0 && !upcoming(view) ? (
                <li className="text-[14px]">Noch keine Lieferung.</li>
              ) : null}
            </ul>
          </SectionCard>

          {editable ? (
            <SectionCard id="abo-kuendigen" title="Abo kündigen" tone="outline">
              <p className="text-[14px] leading-[1.5]">
                Die Kündigung gilt sofort für alle künftigen Lieferungen, es wird nichts mehr
                abgebucht. Du bekommst eine Bestätigung per E-Mail.
              </p>
              <Link
                href={`${base}?dialog=kuendigen` as Route}
                scroll={false}
                className={`${BTN_OUTLINE} self-start`}
              >
                Abo kündigen
              </Link>
            </SectionCard>
          ) : null}
        </aside>
      </div>

      {dialog ? <DialogFor dialog={dialog} view={view} base={base} mode={mode} /> : null}
    </AccountShell>
  );
}

const ORDER_STATUS: Record<string, string> = {
  pending: "Offen",
  paid: "Bezahlt",
  processing: "In Bearbeitung",
  shipped: "Versendet",
  delivered: "Zugestellt",
  cancelled: "Storniert",
  refunded: "Erstattet",
  partially_refunded: "Teilweise erstattet",
};

function upcoming(view: SubscriptionDetailView): string | null {
  const { row } = view;
  if (row.status === "past_due" && row.past_due_since) return formatDay(row.past_due_since);
  const next = effectiveNextDelivery(row);
  return next ? formatDay(next) : null;
}

function PaymentProblem({
  view,
  base,
  mode,
  needsConfirmation,
}: {
  view: SubscriptionDetailView;
  base: string;
  mode: "mock" | "live";
  needsConfirmation: boolean;
}) {
  const { row, card } = view;
  if (needsConfirmation) {
    return (
      <div id="zahlung-bestaetigen" className="flex flex-col gap-3">
        <Notice tone="error" title="Bestätigung deiner Bank nötig">
          Für deine Lieferung über {formatEur(card.totalCents)} möchte deine Bank eine kurze
          Bestätigung (3-D Secure). Bis dahin halten wir die Dosen für dich zurück.
        </Notice>
        {mode === "live" ? (
          <ConfirmPaymentLive
            subscriptionId={row.id}
            publishableKey={publicEnv.stripePublishableKey}
          />
        ) : (
          <form action={confirmPaymentFormAction}>
            <input type="hidden" name="id" value={row.id} />
            <SubmitButton pendingLabel="Wird bestätigt …" className="btn-primary w-full">
              Zahlung bestätigen (Testmodus)
            </SubmitButton>
          </form>
        )}
      </div>
    );
  }
  const retry = view.retryDates.map((d) => formatDay(d)).join(" und ");
  return (
    <div className="flex flex-col gap-3">
      <Notice tone="error" role="alert" title="Zahlung fehlgeschlagen">
        Wir konnten {formatEur(card.totalCents)} für deine Lieferung
        {row.past_due_since ? ` vom ${formatDay(row.past_due_since)}` : ""} nicht abbuchen, deine
        Bank hat abgelehnt.{" "}
        {row.status === "paused"
          ? "Deshalb ist dein Abo pausiert, bis du ein neues Zahlungsmittel hinterlegst."
          : retry
            ? `Wir versuchen es am ${retry} noch einmal. Klappt es dann nicht, pausieren wir dein Abo.`
            : "Klappt es auch beim nächsten Versuch nicht, pausieren wir dein Abo."}
      </Notice>
      <Link
        href={`${base}?dialog=zahlungsmittel` as Route}
        scroll={false}
        className="btn-primary w-full"
      >
        Zahlungsmittel aktualisieren
      </Link>
    </div>
  );
}

function DeliveryCard({ view, base }: { view: SubscriptionDetailView; base: string }) {
  const { row, card } = view;
  const next = effectiveNextDelivery(row);
  const amount = `${packLabel(card)} · ${formatEur(card.totalCents)} inkl. ${formatEur(card.depositCents)} Pfand${card.shippingCents > 0 ? ` und ${formatEur(card.shippingCents)} Versand` : ", versandkostenfrei"}`;
  let title = "Nächste Lieferung";
  let label = "Lieferung und Abbuchung am";
  let date = next ? formatDay(next) : "";
  let alert = false;
  if (row.status === "past_due") {
    title = "Offene Lieferung";
    label = "Wartet auf Zahlung seit";
    date = row.past_due_since ? formatDay(row.past_due_since) : "";
    alert = true;
  } else if (row.status === "paused") {
    title = "Pausiert";
    label =
      row.pause_reason === "payment_failed"
        ? "Pausiert wegen offener Zahlung"
        : "Nächste Lieferung nach der Pause am";
    date =
      row.pause_reason === "payment_failed"
        ? ""
        : row.paused_until
          ? formatDay(row.paused_until)
          : "";
  } else if (row.status === "cancelled") {
    title = "Abo beendet";
    label = "Gekündigt am";
    date = row.cancelled_at ? formatDay(row.cancelled_at) : "";
  }
  return (
    <SectionCard id="naechste-lieferung" title={title}>
      <div className="flex items-start gap-4">
        <CanImage
          src={card.imageUrl}
          alt={card.productTitle}
          handle={card.productHandle}
          size="sm"
        />
        <div className="min-w-0">
          <p className="text-pv-wildberry text-[13px]">{label}</p>
          {date ? (
            <p
              className={`text-[28px] leading-[1.15] font-bold ${alert ? "text-pv-wildberry" : ""}`}
            >
              {date}
            </p>
          ) : null}
          <p className="mt-1 text-[14px] leading-[1.45]">{amount}</p>
          {row.skip_next && row.status === "active" && row.next_order_at ? (
            <p className="text-pv-wildberry mt-1 text-[13px]">
              Die Lieferung am {formatDay(row.next_order_at)} ist übersprungen.
            </p>
          ) : null}
          {row.cancel_effective_at && row.status !== "cancelled" ? (
            <p className="text-pv-wildberry mt-1 text-[13px] font-bold">
              Gekündigt zum {formatDay(row.cancel_effective_at)}.
            </p>
          ) : null}
        </div>
      </div>
      {row.status === "active" ? (
        <>
          <p className="text-pv-wildberry text-[13px]">
            Wir erinnern dich {view.settings.reminderDays} Tage vorher per E-Mail. Bis dahin kannst
            du alles ändern.
          </p>
          <div className="flex flex-wrap gap-3">
            {row.skip_next ? (
              <form action={skipAction}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="skip" value="0" />
                <SubmitButton className={BTN_OUTLINE} pendingLabel="Einen Moment …">
                  Doch liefern
                </SubmitButton>
              </form>
            ) : (
              <Link
                href={`${base}?dialog=ueberspringen` as Route}
                scroll={false}
                className={BTN_OUTLINE}
              >
                Überspringen
              </Link>
            )}
            <Link href={`${base}?dialog=pausieren` as Route} scroll={false} className={BTN_OUTLINE}>
              Pausieren
            </Link>
          </div>
        </>
      ) : row.status === "paused" && row.pause_reason !== "payment_failed" ? (
        <div className="flex flex-wrap gap-3">
          <Link href={`${base}?dialog=fortsetzen` as Route} scroll={false} className={BTN_OUTLINE}>
            Jetzt fortsetzen
          </Link>
          <Link href={`${base}?dialog=pausieren` as Route} scroll={false} className={BTN_OUTLINE}>
            Pause ändern
          </Link>
        </div>
      ) : null}
    </SectionCard>
  );
}

function DialogFor({
  dialog,
  view,
  base,
  mode,
}: {
  dialog: DialogKey;
  view: SubscriptionDetailView;
  base: string;
  mode: "mock" | "live";
}) {
  const { row, card } = view;
  const now = new Date();
  if (row.status === "cancelled") return null;

  if (
    dialog === "pausieren" &&
    (row.status === "active" || row.status === "paused") &&
    row.pause_reason !== "payment_failed"
  ) {
    const next = row.status === "active" && row.next_order_at ? new Date(row.next_order_at) : null;
    const suggestions = pauseSuggestions(next, now, view.settings.pauseMaxDays).map((s) => ({
      weeks: s.weeks,
      day: s.day,
      label: formatDay(s.until),
    }));
    const defaultDay = suggestions[1]?.day ?? berlinDay(addDeliveryDays(now, 28));
    return (
      <AboDialog title="Abo pausieren" closeHref={base}>
        <PauseForm
          subscriptionId={row.id}
          suggestions={suggestions}
          minDay={berlinDay(addDeliveryDays(now, 1))}
          maxDay={berlinDay(addDeliveryDays(now, view.settings.pauseMaxDays))}
          defaultDay={defaultDay}
          closeHref={base}
        />
      </AboDialog>
    );
  }
  if (dialog === "kuendigen") {
    const next = effectiveNextDelivery(row);
    return (
      <AboDialog title="Abo wirklich kündigen?" closeHref={base}>
        <CancelForm
          subscriptionId={row.id}
          summary={`${card.productTitle} · ${packLabel(card)}`}
          detail={`Ab sofort keine weiteren Lieferungen.${next ? ` Die geplante Lieferung am ${formatDay(next)} entfällt,` : ""} es wird nichts mehr abgebucht.`}
          closeHref={base}
          pauseHref={row.status === "active" ? `${base}?dialog=pausieren` : null}
        />
      </AboDialog>
    );
  }
  if (dialog === "adresse") {
    const a = view.address;
    return (
      <AboDialog title="Lieferadresse ändern" closeHref={base}>
        <AddressForm
          subscriptionId={row.id}
          closeHref={base}
          initial={{
            firstName: a?.first_name ?? "",
            lastName: a?.last_name ?? "",
            street: a ? [a.street, a.house_number].filter(Boolean).join(" ") : "",
            addressAddition: a?.address_addition ?? "",
            postalCode: a?.postal_code ?? "",
            city: a?.city ?? "",
          }}
        />
      </AboDialog>
    );
  }
  if (dialog === "zahlungsmittel") {
    const paymentOpen = row.status === "past_due" || row.pause_reason === "payment_failed";
    return (
      <AboDialog
        title={paymentOpen ? "Zahlungsmittel aktualisieren" : "Zahlungsmittel ändern"}
        closeHref={base}
      >
        {mode === "live" ? (
          <StripeSetupForm
            subscriptionId={row.id}
            publishableKey={publicEnv.stripePublishableKey}
          />
        ) : (
          <MockPaymentMethodForm
            subscriptionId={row.id}
            closeHref={base}
            paymentOpen={paymentOpen}
          />
        )}
      </AboDialog>
    );
  }
  if (
    dialog === "ueberspringen" &&
    row.status === "active" &&
    row.next_order_at &&
    !row.skip_next
  ) {
    const skipped = new Date(row.next_order_at);
    const following = nextOrderAfterSkip(skipped, row.interval_count);
    return (
      <AboDialog title="Nächste Lieferung überspringen?" closeHref={base}>
        <p className="text-[15px] leading-[1.5]">
          Die Lieferung am {formatDay(skipped)} entfällt, es wird nichts abgebucht. Danach geht es
          am {formatDay(following)} im gewohnten Rhythmus weiter.
        </p>
        <form
          action={skipAction}
          className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"
        >
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="skip" value="1" />
          <Link
            href={base as Route}
            scroll={false}
            className="btn-pill border-pv-wildberry text-pv-wildberry border-[1.5px]"
          >
            Abbrechen
          </Link>
          <SubmitButton className="btn-primary" pendingLabel="Einen Moment …">
            Lieferung überspringen
          </SubmitButton>
        </form>
      </AboDialog>
    );
  }
  if (dialog === "fortsetzen" && row.status === "paused" && row.pause_reason !== "payment_failed") {
    return (
      <AboDialog title="Abo jetzt fortsetzen?" closeHref={base}>
        <p className="text-[15px] leading-[1.5]">
          Deine nächste Lieferung kommt dann am {formatDay(resumeNextOrderAt(now))}, danach alle{" "}
          {row.interval_count} Wochen. Abgebucht wird am Liefertag.
        </p>
        <form
          action={resumeAction}
          className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"
        >
          <input type="hidden" name="id" value={row.id} />
          <Link
            href={base as Route}
            scroll={false}
            className="btn-pill border-pv-wildberry text-pv-wildberry border-[1.5px]"
          >
            Abbrechen
          </Link>
          <SubmitButton className="btn-primary" pendingLabel="Einen Moment …">
            Jetzt fortsetzen
          </SubmitButton>
        </form>
      </AboDialog>
    );
  }
  return null;
}
