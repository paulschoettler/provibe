"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  Checkbox,
  Field,
  FieldError,
  Honeypot,
  Notice,
  SubmitButton,
  Textarea,
} from "@/components/forms";
import { SiteLink } from "@/components/layout/SiteLink";
import { submitWithdrawalForm } from "@/lib/forms/withdrawal";
import { FORM_ERROR_TITLE, INITIAL_WITHDRAWAL_STATE } from "@/lib/forms/state";

function Step({ n, children, id }: { n: number; children: React.ReactNode; id: string }) {
  return (
    <h2
      id={id}
      className="text-wine m-0 flex items-center gap-[10px] text-[20px] font-semibold lg:text-[22px]"
    >
      <span className="pv-step" aria-hidden="true">
        {n}
      </span>
      {children}
    </h2>
  );
}

/**
 * Elektronische Widerrufsfunktion (Figma 27:4586 / 27:4764). Ein Formular, zwei Buttons:
 * "Bestellung finden" lädt die Positionen zur Mehrfachauswahl (optional),
 * "Widerruf absenden" speichert und schickt die Eingangsbestätigung. Beides ohne JavaScript nutzbar.
 */
export function WithdrawalForm() {
  const [state, action] = useActionState(submitWithdrawalForm, INITIAL_WITHDRAWAL_STATE);
  const errorRef = useRef<HTMLDivElement>(null);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const selected = new Set(state.selectedItems ?? []);
  const items = state.orderItems ?? [];

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  return (
    <form action={action} className="pv-form-card !gap-5" noValidate aria-label="Widerruf erklären">
      {/* Standard-Button für Enter: sendet den Widerruf, nicht die Bestellsuche */}
      <button
        type="submit"
        name="intent"
        value="submit"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      >
        Widerruf absenden
      </button>
      {state.status === "error" ? (
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          <Notice variant="error" title={FORM_ERROR_TITLE}>
            <p>{state.message}</p>
          </Notice>
        </div>
      ) : null}

      <section aria-labelledby="schritt-1" className="flex flex-col gap-4">
        <Step n={1} id="schritt-1">
          Bestellung finden
        </Step>
        <div className="pv-form-grid pv-form-grid--2">
          <Field
            name="orderNumber"
            label="Bestellnummer"
            placeholder="#1042"
            required
            maxLength={40}
            autoComplete="off"
            defaultValue={v.orderNumber}
            error={e.orderNumber}
            hint="Steht in deiner Bestellbestätigung."
          />
          <Field
            name="email"
            type="email"
            label="E-Mail der Bestellung"
            placeholder="deine@email.de"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={254}
            defaultValue={v.email}
            error={e.email}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton
            variant="secondary"
            name="intent"
            value="lookup"
            formNoValidate
            pendingLabel="Suche …"
          >
            Bestellung finden
          </SubmitButton>
          <span role="status" aria-live="polite">
            {state.lookup === "found" && items.length > 0 ? (
              <span className="pv-found">
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path
                    d="M3.75 9.375L7.125 12.75L14.25 5.625"
                    stroke="#D9306E"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Bestellung gefunden, wähle die Artikel aus.
              </span>
            ) : state.lookup ? (
              <span className="pv-form-hint">
                Keine passende Bestellung gefunden. Trag die Artikel einfach unten ein.
              </span>
            ) : (
              <span className="pv-form-hint">
                Optional: Wir zeigen dir dann die Artikel zur Auswahl.
              </span>
            )}
          </span>
        </div>
      </section>

      <section aria-labelledby="schritt-2" className="flex flex-col gap-3">
        <Step n={2} id="schritt-2">
          Artikel auswählen
        </Step>
        {items.length > 0 ? (
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 text-[14px] font-medium">
              Welche Artikel möchtest du widerrufen? Mehrfachauswahl möglich.
            </legend>
            <div className="pv-check-list">
              {items.map((item, i) => (
                <Checkbox
                  key={item.value}
                  id={`artikel-${i}`}
                  name="items"
                  value={item.value}
                  defaultChecked={selected.has(item.value)}
                  describedById={e.itemsText ? "feld-itemsText-fehler" : undefined}
                >
                  {item.label}
                </Checkbox>
              ))}
            </div>
          </fieldset>
        ) : null}
        <Textarea
          name="itemsText"
          label={items.length > 0 ? "Weitere Artikel" : "Welche Artikel möchtest du widerrufen?"}
          optional={items.length > 0}
          placeholder="Zum Beispiel: Wildberry, 12 Dosen"
          rows={3}
          maxLength={2000}
          defaultValue={v.itemsText}
          error={items.length > 0 ? undefined : e.itemsText}
        />
        {items.length > 0 && e.itemsText ? (
          <FieldError id="feld-itemsText-fehler" message={e.itemsText} />
        ) : null}
      </section>

      <section aria-labelledby="schritt-3" className="flex flex-col gap-4">
        <Step n={3} id="schritt-3">
          Deine Angaben
        </Step>
        <Field
          name="name"
          label="Name"
          placeholder="Vor- und Nachname"
          autoComplete="name"
          required
          maxLength={120}
          defaultValue={v.name}
          error={e.name}
        />
        <Textarea
          name="reason"
          label="Grund"
          optional
          placeholder="Möchtest du uns sagen, warum? Das hilft uns, besser zu werden."
          maxLength={2000}
          defaultValue={v.reason}
          error={e.reason}
        />
      </section>

      <Honeypot />
      <p className="pv-form-fine">
        Mit dem Absenden verarbeiten wir deine Angaben, um deinen Widerruf zu bearbeiten. Mehr dazu
        in der <SiteLink href="/policies/privacy-policy">Datenschutzerklärung</SiteLink>.
      </p>
      <div>
        <SubmitButton name="intent" value="submit" pendingLabel="Wird gesendet …">
          Widerruf absenden
        </SubmitButton>
      </div>
    </form>
  );
}

export default WithdrawalForm;
