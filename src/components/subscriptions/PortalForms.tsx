"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Notice } from "@/components/account/ui";
import { SubmitButton } from "@/components/account/SubmitButton";
import { formatEur } from "@/lib/money";
import {
  addressAction,
  cancelAction,
  mockPaymentMethodAction,
  pauseAction,
  savePlanAction,
} from "@/lib/subscriptions/actions";
import { CANCEL_REASONS, INITIAL_ABO_STATE, type AboFormState } from "@/lib/subscriptions/types";

/**
 * Formulare des Abo-Portals (Client-Komponenten mit useActionState). Jedes Formular funktioniert
 * auch ohne JavaScript als normales Submit; Fehler erscheinen mit aria-describedby am Feld.
 */

function FormError({ state }: { state: AboFormState }) {
  if (state.status !== "error" || !state.message) return null;
  return (
    <Notice tone="error" role="alert" title="Das hat nicht geklappt">
      {state.message}
    </Notice>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-pv-wildberry text-[13px] font-bold">
      {message}
    </p>
  );
}

/** Mixed hat kein eigenes Dosenbild: drei Sorten nebeneinander */
const MIXED_CANS = [
  "/images/cans/wildberry.webp",
  "/images/cans/raspberry-lime.webp",
  "/images/cans/peach.webp",
];

/* ---------- Sorte, Packgröße, Intervall (Figma 66:1168 "Sorte", "Menge und Intervall") ---------- */

export interface PlanFlavor {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
}

export interface PlanPack {
  variantId: string;
  title: string;
  unitCount: number;
  goodsCents: number;
  depositCents: number;
  perCanCents: number;
  basePriceText: string;
}

export function PlanForm({
  subscriptionId,
  flavors,
  currentProductId,
  packs,
  currentUnitCount,
  intervals,
  currentInterval,
  discountBp,
}: {
  subscriptionId: string;
  flavors: PlanFlavor[];
  currentProductId: string | null;
  packs: PlanPack[];
  currentUnitCount: number;
  intervals: number[];
  currentInterval: number;
  discountBp: number;
}) {
  const [state, action] = useActionState(savePlanAction, INITIAL_ABO_STATE);
  const [productId, setProductId] = useState(currentProductId ?? flavors[0]?.id ?? "");
  const currentPack = packs.find((p) => p.unitCount === currentUnitCount) ?? packs[0];
  const percent = (discountBp / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 });
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={subscriptionId} />
      <FormError state={state} />

      <section
        className="rounded-card bg-pv-cream flex flex-col gap-3 p-5 shadow-[0_12px_32px_-6px_var(--pv-ui-shadow-color)]"
        aria-labelledby="sorte-titel"
      >
        <h2 id="sorte-titel" className="text-[20px] font-medium">
          Sorte
        </h2>
        <p className="text-pv-wildberry text-[13px]">
          Ein Wechsel gilt ab der nächsten Lieferung, der Preis bleibt gleich.
        </p>
        <fieldset>
          <legend className="sr-only">Sorte wählen</legend>
          <div className="grid grid-cols-3 gap-2.5">
            {flavors.map((f) => (
              <div key={f.id} className="relative">
                <input
                  id={`sorte-${f.id}`}
                  type="radio"
                  name="productId"
                  value={f.id}
                  checked={productId === f.id}
                  onChange={() => setProductId(f.id)}
                  className="peer sr-only"
                />
                <label htmlFor={`sorte-${f.id}`} className="pvc-pack pv-abo-flavor">
                  <span className="pvc-pack-check" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="size-3.5">
                      <path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {f.imageUrl ? (
                    <Image
                      style={{ width: "auto" }}
                      src={f.imageUrl}
                      alt=""
                      width={56}
                      height={84}
                      className="h-[72px] w-auto object-contain lg:h-[84px]"
                    />
                  ) : (
                    <span className="flex h-[72px] items-end lg:h-[84px]" aria-hidden="true">
                      {MIXED_CANS.map((src, i) => (
                        <Image
                          style={{ width: "auto" }}
                          key={src}
                          src={src}
                          alt=""
                          width={32}
                          height={56}
                          className={`h-[56px] w-auto object-contain lg:h-[66px] ${i > 0 ? "-ml-3" : ""}`}
                        />
                      ))}
                    </span>
                  )}
                  <span className="text-[13px] font-bold">{f.title}</span>
                </label>
              </div>
            ))}
          </div>
        </fieldset>
      </section>

      <section
        className="rounded-card bg-pv-cream flex flex-col gap-3 p-5 shadow-[0_12px_32px_-6px_var(--pv-ui-shadow-color)]"
        aria-labelledby="menge-titel"
      >
        <h2 id="menge-titel" className="text-[20px] font-medium">
          Menge und Intervall
        </h2>
        <fieldset>
          <legend className="mb-2.5 text-[15px] font-bold">Packgröße je Lieferung</legend>
          <div className="grid grid-cols-3 gap-2.5">
            {packs.map((p) => (
              <div key={p.variantId} className="relative">
                <input
                  id={`pack-${p.variantId}`}
                  type="radio"
                  name="variantId"
                  value={p.variantId}
                  defaultChecked={p.variantId === currentPack?.variantId}
                  className="peer sr-only"
                />
                <label htmlFor={`pack-${p.variantId}`} className="pvc-pack">
                  <span className="pvc-pack-check" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="size-3.5">
                      <path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="text-[14px] font-bold">{p.title}</span>
                  <span className="text-[16px] font-bold">{formatEur(p.goodsCents)}</span>
                  <span className="text-[11px]">zzgl. {formatEur(p.depositCents)} Pfand</span>
                  <span className="text-pv-wildberry text-[11px]">
                    {formatEur(p.perCanCents)} je Dose
                  </span>
                  <span className="text-[11px]">{p.basePriceText}</span>
                </label>
              </div>
            ))}
          </div>
          <p className="text-pv-wildberry mt-2 text-[12px]">
            Abo-Preise je Lieferung mit {percent} % Rabatt auf den Warenwert, Pfand getrennt,
            Versand ab der Grenze kostenlos.
          </p>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-[15px] font-bold">Liefern alle</legend>
          <div className="grid grid-cols-4 gap-2">
            {intervals.map((w) => (
              <div key={w}>
                <input
                  id={`iv-${w}`}
                  type="radio"
                  name="intervalWeeks"
                  value={w}
                  defaultChecked={w === currentInterval}
                  className="peer sr-only"
                />
                <label htmlFor={`iv-${w}`} className="pv-abo-interval">
                  {w} Wochen
                </label>
              </div>
            ))}
          </div>
        </fieldset>
        <SubmitButton pendingLabel="Wird gespeichert …" className="btn-primary w-full">
          Änderungen speichern
        </SubmitButton>
      </section>
    </form>
  );
}

/* ---------- Pausieren (Figma 68:1101) ---------- */

export function PauseForm({
  subscriptionId,
  suggestions,
  minDay,
  maxDay,
  defaultDay,
  closeHref,
}: {
  subscriptionId: string;
  suggestions: { weeks: number; day: string; label: string }[];
  minDay: string;
  maxDay: string;
  defaultDay: string;
  closeHref: string;
}) {
  const [state, action] = useActionState(pauseAction, INITIAL_ABO_STATE);
  const [option, setOption] = useState(
    state.values?.option || (suggestions[1] ? String(suggestions[1].weeks) : "date"),
  );
  const [until, setUntil] = useState(state.values?.until || defaultDay);
  const untilLabel =
    option === "date"
      ? until.split("-").reverse().join(".")
      : suggestions.find((s) => String(s.weeks) === option)?.label;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={subscriptionId} />
      <p className="text-[15px] leading-[1.5]">
        Während der Pause liefern wir nichts und buchen nichts ab. Danach läuft dein Abo im
        gewohnten Rhythmus weiter.
      </p>
      <FormError state={state} />
      <fieldset className="flex flex-col gap-2.5">
        <legend className="sr-only">Dauer der Pause</legend>
        {suggestions.map((s) => (
          <label key={s.weeks} className="co-choice !min-h-[64px]">
            <input
              type="radio"
              name="option"
              value={s.weeks}
              checked={option === String(s.weeks)}
              onChange={() => setOption(String(s.weeks))}
              className="co-radio"
            />
            <span className="flex flex-col leading-[1.35]">
              <span className="text-[16px] font-bold">{s.weeks} Wochen</span>
              <span className="text-pv-wildberry text-[13px]">Nächste Lieferung am {s.label}</span>
            </span>
          </label>
        ))}
        <label className="co-choice !min-h-[64px]">
          <input
            type="radio"
            name="option"
            value="date"
            checked={option === "date"}
            onChange={() => setOption("date")}
            className="co-radio"
          />
          <span className="flex flex-col leading-[1.35]">
            <span className="text-[16px] font-bold">Bis zu einem Datum</span>
            <span className="text-pv-wildberry text-[13px]">
              Du wählst den Tag der nächsten Lieferung
            </span>
          </span>
        </label>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pause-bis" className="text-[14px] font-bold">
          Pausieren bis
        </label>
        <input
          id="pause-bis"
          type="date"
          name="until"
          min={minDay}
          max={maxDay}
          value={until}
          onChange={(e) => {
            setUntil(e.target.value);
            setOption("date");
          }}
          aria-describedby="pause-bis-hinweis pause-bis-fehler"
          aria-invalid={state.fieldErrors?.until ? true : undefined}
          className="pv-acc-input"
        />
        <p id="pause-bis-hinweis" className="text-[13px]">
          An diesem Tag kommt deine nächste Lieferung. Höchstens 6 Monate.
        </p>
        <FieldError id="pause-bis-fehler" message={state.fieldErrors?.until} />
      </div>
      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <p className="text-pv-wildberry text-[13px] sm:mr-auto">Pause jederzeit beendbar.</p>
        <Link
          href={closeHref as Route}
          scroll={false}
          className="btn-pill border-pv-wildberry text-pv-wildberry border-[1.5px]"
        >
          Abbrechen
        </Link>
        <SubmitButton pendingLabel="Wird pausiert …" className="btn-primary">
          {untilLabel ? `Bis ${untilLabel} pausieren` : "Pausieren"}
        </SubmitButton>
      </div>
    </form>
  );
}

/* ---------- Kündigen (Figma 68:1287) ---------- */

export function CancelForm({
  subscriptionId,
  summary,
  detail,
  closeHref,
  pauseHref,
}: {
  subscriptionId: string;
  summary: string;
  detail: string;
  closeHref: string;
  pauseHref: string | null;
}) {
  const [state, action] = useActionState(cancelAction, INITIAL_ABO_STATE);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={subscriptionId} />
      <div className="bg-pv-cream rounded-[18px] p-4">
        <p className="text-[15px] font-bold">{summary}</p>
        <p className="mt-1 text-[14px] leading-[1.5]">{detail}</p>
      </div>
      <FormError state={state} />
      <fieldset>
        <legend className="mb-2.5 text-[15px] font-bold">
          Magst du uns sagen, warum? (optional)
        </legend>
        <div className="flex flex-wrap gap-2">
          {CANCEL_REASONS.map((r) => (
            <div key={r.id}>
              <input
                id={`grund-${r.id}`}
                type="radio"
                name="reason"
                value={r.id}
                className="peer sr-only"
              />
              <label htmlFor={`grund-${r.id}`} className="pv-abo-interval !px-4">
                {r.label}
              </label>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="kuendigen-notiz" className="text-[14px] font-bold">
          Noch etwas für uns? (optional)
        </label>
        <textarea
          id="kuendigen-notiz"
          name="note"
          rows={3}
          maxLength={1000}
          defaultValue={state.values?.note}
          placeholder="Ich hab noch genug Dosen im Keller, melde mich wieder."
          className="pv-acc-input !h-auto min-h-[96px] py-3"
        />
      </div>
      {pauseHref ? (
        <p className="text-[14px]">
          Lieber erst mal Pause?{" "}
          <Link
            href={pauseHref as Route}
            scroll={false}
            className="text-pv-wildberry font-bold underline underline-offset-2"
          >
            Abo pausieren
          </Link>
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <p className="text-pv-wildberry text-[13px] sm:mr-auto">Bestätigung kommt per E-Mail.</p>
        <Link
          href={closeHref as Route}
          scroll={false}
          className="btn-pill border-pv-wildberry text-pv-wildberry border-[1.5px]"
          data-autofocus
        >
          Abo behalten
        </Link>
        <SubmitButton pendingLabel="Wird gekündigt …" className="btn-primary">
          Jetzt kündigen
        </SubmitButton>
      </div>
    </form>
  );
}

/* ---------- Lieferadresse ---------- */

export function AddressForm({
  subscriptionId,
  initial,
  closeHref,
}: {
  subscriptionId: string;
  initial: Record<string, string>;
  closeHref: string;
}) {
  const [state, action] = useActionState(addressAction, INITIAL_ABO_STATE);
  const values = state.values ?? initial;
  const errors = state.fieldErrors ?? {};
  const field = (
    name: string,
    label: string,
    autoComplete: string,
    optional = false,
    className = "",
  ) => (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={`adr-${name}`} className="text-[14px] font-bold">
        {label}
        {optional ? <span className="text-pv-wildberry font-normal"> (optional)</span> : null}
      </label>
      <input
        id={`adr-${name}`}
        name={name}
        defaultValue={values[name] ?? ""}
        autoComplete={autoComplete}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `adr-${name}-fehler` : undefined}
        className={`pv-acc-input ${errors[name] ? "pv-acc-input--error" : ""}`}
      />
      <FieldError id={`adr-${name}-fehler`} message={errors[name]} />
    </div>
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={subscriptionId} />
      <FormError state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        {field("firstName", "Vorname", "given-name")}
        {field("lastName", "Nachname", "family-name")}
      </div>
      {field("street", "Straße und Hausnummer", "street-address")}
      {field("addressAddition", "Adresszusatz", "address-line2", true)}
      <div className="grid grid-cols-[120px_1fr] gap-3">
        {field("postalCode", "PLZ", "postal-code")}
        {field("city", "Ort", "address-level2")}
      </div>
      <p className="text-[13px]">
        Lieferung nur innerhalb Deutschlands. Gilt ab der nächsten Lieferung.
      </p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href={closeHref as Route}
          scroll={false}
          className="btn-pill border-pv-wildberry text-pv-wildberry border-[1.5px]"
        >
          Abbrechen
        </Link>
        <SubmitButton pendingLabel="Wird gespeichert …" className="btn-primary">
          Adresse speichern
        </SubmitButton>
      </div>
    </form>
  );
}

/* ---------- Zahlungsmittel (Mock: Testkarte; live: StripeSetupForm) ---------- */

export function MockPaymentMethodForm({
  subscriptionId,
  closeHref,
  paymentOpen,
}: {
  subscriptionId: string;
  closeHref: string;
  paymentOpen: boolean;
}) {
  const [state, action] = useActionState(mockPaymentMethodAction, INITIAL_ABO_STATE);
  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};
  const [method, setMethod] = useState(values.method || "card");
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={subscriptionId} />
      <FormError state={state} />
      <fieldset className="flex flex-col gap-2.5">
        <legend className="sr-only">Zahlart</legend>
        {[
          { id: "card", title: "Karte", text: "Visa, Mastercard, Maestro, American Express" },
          { id: "paypal", title: "PayPal", text: "Im Testmodus ohne Weiterleitung" },
        ].map((m) => (
          <label key={m.id} className="co-choice !min-h-[64px]">
            <input
              type="radio"
              name="method"
              value={m.id}
              checked={method === m.id}
              onChange={() => setMethod(m.id)}
              className="co-radio"
            />
            <span className="flex flex-col leading-[1.35]">
              <span className="text-[16px] font-bold">{m.title}</span>
              <span className="text-[13px]">{m.text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {method === "card" ? (
        <div className="border-pv-wildberry bg-pv-white flex flex-col gap-3 rounded-[14px] border-[1.5px] border-dashed p-3.5">
          <p className="text-pv-wildberry font-condensed text-[11px] font-bold tracking-[0.12em] uppercase">
            Testmodus: Karte wird simuliert
          </p>
          {[
            {
              name: "cardNumber",
              label: "Kartennummer",
              placeholder: "1234 1234 1234 1234",
              auto: "cc-number",
              hint: "4242 4242 4242 4242 (klappt), 4000 0000 0000 0341 (spätere Abbuchung abgelehnt), 4000 0027 6000 3184 (Bestätigung nötig)",
            },
          ].map((f) => (
            <div key={f.name} className="flex flex-col gap-1.5">
              <label htmlFor={`pm-${f.name}`} className="text-[14px] font-bold">
                {f.label}
              </label>
              <input
                id={`pm-${f.name}`}
                name={f.name}
                inputMode="numeric"
                autoComplete={f.auto}
                placeholder={f.placeholder}
                defaultValue={values[f.name]}
                aria-invalid={errors[f.name] ? true : undefined}
                aria-describedby={`pm-${f.name}-hinweis pm-${f.name}-fehler`}
                className="co-input"
              />
              <p id={`pm-${f.name}-hinweis`} className="text-[12px]">
                {f.hint}
              </p>
              <FieldError id={`pm-${f.name}-fehler`} message={errors[f.name]} />
            </div>
          ))}
          <div className="flex gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor="pm-cardExpiry" className="text-[14px] font-bold">
                Ablaufdatum
              </label>
              <input
                id="pm-cardExpiry"
                name="cardExpiry"
                placeholder="MM / JJ"
                autoComplete="cc-exp"
                defaultValue={values.cardExpiry}
                aria-invalid={errors.cardExpiry ? true : undefined}
                aria-describedby="pm-cardExpiry-fehler"
                className="co-input"
              />
              <FieldError id="pm-cardExpiry-fehler" message={errors.cardExpiry} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor="pm-cardCvc" className="text-[14px] font-bold">
                CVC
              </label>
              <input
                id="pm-cardCvc"
                name="cardCvc"
                inputMode="numeric"
                placeholder="123"
                maxLength={4}
                autoComplete="cc-csc"
                aria-invalid={errors.cardCvc ? true : undefined}
                aria-describedby="pm-cardCvc-fehler"
                className="co-input"
              />
              <FieldError id="pm-cardCvc-fehler" message={errors.cardCvc} />
            </div>
          </div>
        </div>
      ) : null}
      <p className="text-[13px] leading-[1.45]">
        {paymentOpen
          ? "Sobald dein neues Zahlungsmittel gespeichert ist, buchen wir die offene Lieferung ab und schicken los."
          : "Wir speichern das Zahlungsmittel verschlüsselt bei Stripe und belasten es erst am jeweiligen Liefertag."}
      </p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href={closeHref as Route}
          scroll={false}
          className="btn-pill border-pv-wildberry text-pv-wildberry border-[1.5px]"
        >
          Abbrechen
        </Link>
        <SubmitButton pendingLabel="Wird gespeichert …" className="btn-primary">
          Zahlungsmittel speichern
        </SubmitButton>
      </div>
    </form>
  );
}
