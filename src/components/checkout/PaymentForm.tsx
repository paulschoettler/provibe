"use client";

import type { Route } from "next";
import Link from "next/link";
import { useActionState, useCallback, useRef, useState, useTransition } from "react";
import { placeOrderAction, startLivePaymentAction } from "@/lib/checkout/actions";
import { LEGAL_LINKS } from "@/lib/checkout/links";
import { INITIAL_FORM_STATE, PAYMENT_METHODS, type FormState } from "@/lib/checkout/types";
import { Checkbox, Field } from "./fields";
import { CardIcon, ChevronLeftIcon, LockIcon } from "./icons";
import { Notice } from "./parts";
import { StripePaymentElement, type StripeHandle } from "./StripePaymentElement";

/**
 * Schritt 2: Zahlart, Bestellübersicht unmittelbar vor dem Button "Zahlungspflichtig bestellen"
 * (§ 312j BGB), AGB- und Widerrufshinweis als Textzeile ohne Checkbox, Newsletter nicht
 * vorangekreuzt (Figma 26:5997, 26:6252, 26:6533).
 *
 * mock: Zahlarten als Auswahlkarten, Karte als Testformular. Funktioniert ohne JavaScript.
 * live: Stripe Payment Element (lädt @stripe/stripe-js dynamisch), braucht JavaScript.
 */
export function PaymentForm({
  mode,
  publishableKey,
  clientSecret,
  shownTotal,
  intro,
  summary,
  serverError,
  subscription = null,
}: {
  mode: "mock" | "live";
  publishableKey: string;
  clientSecret: string;
  /** Angezeigter Gesamtbetrag in Cent; der Server vergleicht und lädt bei Abweichung neu */
  shownTotal: number;
  intro: React.ReactNode;
  summary: React.ReactNode;
  serverError?: { title: string; text: string } | null;
  /**
   * Abo-Positionen im Warenkorb (Paket Abo): Pflichtangaben-Block vor dem Button, Button
   * "Zahlungspflichtig abonnieren", kein Klarna (Zahlungsmittel wird gespeichert, H25).
   */
  subscription?: { termsBlock: React.ReactNode } | null;
}) {
  const methods = subscription ? PAYMENT_METHODS.filter((m) => m.id !== "klarna") : PAYMENT_METHODS;
  const [mockState, mockAction, mockPending] = useActionState(placeOrderAction, INITIAL_FORM_STATE);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [livePending, startLive] = useTransition();
  const stripeRef = useRef<StripeHandle | null>(null);
  const onStripeReady = useCallback((handle: StripeHandle) => {
    stripeRef.current = handle;
  }, []);

  const state: FormState = mode === "mock" ? mockState : INITIAL_FORM_STATE;
  const pending = mode === "mock" ? mockPending : livePending;
  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};
  const selected = values.paymentMethod || "card";
  const declined = state.message === "declined";

  function onLiveSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    startLive(async () => {
      setLiveError(null);
      const stripe = stripeRef.current;
      if (!stripe) {
        setLiveError("Die Zahlungsfelder sind noch nicht geladen.");
        return;
      }
      const check = await stripe.validate();
      if (check.error) {
        setLiveError(check.error);
        return;
      }
      const data = new FormData(form);
      data.set("paymentMethod", "card");
      const result = await startLivePaymentAction(INITIAL_FORM_STATE, data);
      if (result.status !== "ok" || !result.clientSecret || !result.returnUrl) {
        setLiveError(result.message ?? "Die Zahlung konnte nicht gestartet werden.");
        return;
      }
      const confirmed = await stripe.confirm(result.clientSecret, result.returnUrl);
      if (confirmed.error) setLiveError(confirmed.error);
    });
  }

  const errorNotice = declined ? (
    <Notice tone="error" title="Zahlung abgelehnt">
      Deine Bank hat die Zahlung nicht freigegeben. Es wurde nichts abgebucht. Prüf deine
      Kartendaten oder wähl eine andere Zahlart.
    </Notice>
  ) : state.status === "error" && state.message ? (
    <Notice tone="error" title="Das hat nicht geklappt">
      {state.message}
    </Notice>
  ) : liveError ? (
    <Notice tone="error" title="Das hat nicht geklappt">
      {liveError}
    </Notice>
  ) : serverError ? (
    <Notice tone="error" title={serverError.title}>
      {serverError.text}
    </Notice>
  ) : null;

  return (
    <form
      action={mode === "mock" ? mockAction : undefined}
      onSubmit={mode === "live" ? onLiveSubmit : undefined}
      noValidate
      className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-[60px]"
    >
      <input type="hidden" name="shownTotal" value={shownTotal} />

      <div className="flex min-w-0 flex-col gap-7">
        {errorNotice ? <div aria-live="assertive">{errorNotice}</div> : null}
        {intro}

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-[20px] leading-[1.2] font-medium">Zahlart</legend>

          {mode === "live" ? (
            <div className="border-pv-ui-gray-300 bg-pv-white rounded-[18px] border-[1.5px] p-4">
              <StripePaymentElement
                publishableKey={publishableKey}
                clientSecret={clientSecret}
                onReady={onStripeReady}
              />
              <noscript>
                <p className="text-pv-wildberry mt-2 text-[14px] font-bold">
                  Zum sicheren Bezahlen brauchst du JavaScript. Bitte aktiviere es in deinem
                  Browser.
                </p>
              </noscript>
            </div>
          ) : (
            methods.map((m) => (
              <div key={m.id} className="co-paycard">
                <label className="co-choice co-choice--pay">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={m.id}
                    defaultChecked={m.id === selected}
                    className="co-radio"
                  />
                  {m.id === "card" ? <CardIcon className="h-[22px] w-[22px]" /> : null}
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px] leading-[1.4]">
                    <span className="text-[16px] font-bold">{m.title}</span>
                    <span className="text-[14px]">{m.subtitle}</span>
                  </span>
                </label>
                {m.id === "card" ? (
                  <div className="co-paycard__panel px-[18px] pb-4">
                    <div className="border-pv-wildberry bg-pv-white flex flex-col gap-3 rounded-[14px] border-[1.5px] border-dashed p-3.5">
                      <p className="text-pv-wildberry font-condensed text-[11px] font-bold tracking-[0.12em] uppercase">
                        Testmodus: Kartenzahlung wird simuliert
                      </p>
                      <Field
                        name="cardNumber"
                        label="Kartennummer"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        placeholder="1234 1234 1234 1234"
                        defaultValue={values.cardNumber}
                        error={errors.cardNumber}
                        hint="Testkarten: 4242 4242 4242 4242 (Erfolg), 4000 0000 0000 0002 (abgelehnt), 4000 0025 0000 3155 (3-D-Secure)"
                      />
                      <div className="flex gap-3">
                        <Field
                          name="cardExpiry"
                          label="Ablaufdatum"
                          className="min-w-0 flex-1"
                          autoComplete="cc-exp"
                          placeholder="MM / JJ"
                          defaultValue={values.cardExpiry}
                          error={errors.cardExpiry}
                        />
                        <Field
                          name="cardCvc"
                          label="CVC"
                          className="min-w-0 flex-1"
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          placeholder="123"
                          maxLength={4}
                          error={errors.cardCvc}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
          {errors.paymentMethod ? (
            <p className="text-pv-wildberry text-[13px] font-bold">{errors.paymentMethod}</p>
          ) : null}
          {subscription ? (
            <>
              <p className="bg-pv-cream rounded-[12px] px-3 py-2 text-[13px] leading-[1.45]">
                Klarna geht beim Abo nicht, weil wir dein Zahlungsmittel für künftige Lieferungen
                speichern.
              </p>
              <p className="flex items-start gap-2 text-[13px] leading-[1.4]">
                <LockIcon className="mt-0.5 h-4 w-4 shrink-0" />
                Dein Zahlungsmittel wird für künftige Lieferungen gespeichert (verschlüsselt bei
                Stripe) und erst am jeweiligen Liefertag belastet.
              </p>
            </>
          ) : (
            <p className="flex items-center gap-2 text-[13px] leading-[1.4]">
              <LockIcon className="h-4 w-4" />
              Zahlungsdaten gehen verschlüsselt direkt an Stripe, nicht an uns.
            </p>
          )}
        </fieldset>

        <BackLink className="hidden lg:flex" />
      </div>

      <aside className="lg:bg-pv-cream lg:shadow-card flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start lg:rounded-[22px] lg:p-5">
        <div className="bg-pv-cream rounded-[22px] p-4 lg:bg-transparent lg:p-0">{summary}</div>
        {subscription?.termsBlock}
        <p className="text-[14px] leading-[1.5]">
          {subscription
            ? "Mit deinem Abo akzeptierst du unsere "
            : "Mit deiner Bestellung akzeptierst du unsere "}
          <Link
            href={LEGAL_LINKS.agb as Route}
            className="text-pv-wildberry font-bold underline underline-offset-2"
          >
            AGB
          </Link>
          {subscription ? " inklusive der Abo-Bedingungen" : ""}. Informationen zum Widerrufsrecht
          findest du{" "}
          <Link
            href={LEGAL_LINKS.widerruf as Route}
            className="text-pv-wildberry font-bold underline underline-offset-2"
          >
            hier
          </Link>
          .
        </p>
        <Checkbox
          name="newsletter"
          label="Ja, ich möchte den Newsletter"
          extra="Optional. Abmeldung jederzeit möglich."
          defaultChecked={values.newsletter === "on"}
        />
        <button type="submit" disabled={pending} className="btn-primary h-14 w-full">
          {pending
            ? "Zahlung läuft …"
            : subscription
              ? "Zahlungspflichtig abonnieren"
              : "Zahlungspflichtig bestellen"}
        </button>
        <p className="hidden items-center justify-center gap-2 text-[12px] lg:flex">
          <LockIcon className="h-3.5 w-3.5" />
          {subscription
            ? "Sicher bezahlen mit Karte, Apple Pay, Google Pay oder PayPal"
            : "Sicher bezahlen mit Karte, Apple Pay, Google Pay, PayPal oder Klarna"}
        </p>
        <BackLink className="flex justify-center lg:hidden" />
      </aside>
    </form>
  );
}

function BackLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href={"/checkout" as Route}
      prefetch={false}
      className={`text-pv-wildberry h-11 items-center gap-1.5 text-[14px] font-bold underline underline-offset-4 ${className}`}
    >
      <ChevronLeftIcon className="h-4 w-4" />
      Zurück zur Adresse
    </Link>
  );
}
