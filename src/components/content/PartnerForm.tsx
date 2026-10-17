"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, Honeypot, Notice, Select, SubmitButton, Textarea } from "@/components/forms";
import { SiteLink } from "@/components/layout/SiteLink";
import { submitPartnerForm } from "@/lib/forms/partner";
import { BUSINESS_TYPES } from "@/lib/forms/schemas";
import { FORM_ERROR_TITLE, INITIAL_FORM_STATE } from "@/lib/forms/state";

/**
 * Partneranfrage (Figma 24:2561). Ohne JavaScript schickt der Browser das Formular normal ab,
 * die Server Action leitet auf /pages/partner/gesendet weiter. Mit JavaScript zeigt
 * useActionState Fehler ohne Neuladen und setzt den Fokus auf die Fehlerbox.
 */
export function PartnerForm() {
  const [state, action] = useActionState(submitPartnerForm, INITIAL_FORM_STATE);
  const errorRef = useRef<HTMLDivElement>(null);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  return (
    <form action={action} className="pv-form-card" noValidate aria-labelledby="partner-form-titel">
      <h3 id="partner-form-titel" className="pv-form-card-title">
        Partneranfrage
      </h3>

      {state.status === "error" ? (
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          <Notice variant="error" title={FORM_ERROR_TITLE}>
            <p>{state.message}</p>
          </Notice>
        </div>
      ) : null}

      <div className="pv-form-grid pv-form-grid--2">
        <Field
          name="company"
          label="Firma"
          placeholder="Name deines Geschäfts"
          autoComplete="organization"
          required
          maxLength={160}
          defaultValue={v.company}
          error={e.company}
        />
        <Field
          name="contactName"
          label="Ansprechpartner"
          placeholder="Vor- und Nachname"
          autoComplete="name"
          required
          maxLength={120}
          defaultValue={v.contactName}
          error={e.contactName}
        />
        <Field
          name="email"
          type="email"
          label="E-Mail"
          placeholder="name@firma.de"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={254}
          defaultValue={v.email}
          error={e.email}
        />
        <Field
          name="phone"
          type="tel"
          label="Telefon"
          optional
          placeholder="+49 …"
          autoComplete="tel"
          inputMode="tel"
          maxLength={40}
          defaultValue={v.phone}
          error={e.phone}
        />
      </div>
      <Select
        name="businessType"
        label="Art des Geschäfts"
        options={[...BUSINESS_TYPES]}
        required
        defaultValue={v.businessType}
        error={e.businessType}
      />
      <Textarea
        name="message"
        label="Nachricht"
        placeholder="Standort, gewünschte Mengen, Fragen zu Konditionen …"
        required
        maxLength={4000}
        defaultValue={v.message}
        error={e.message}
      />
      <Honeypot />
      <p className="pv-form-required">Alle Felder außer Telefon sind Pflichtfelder.</p>
      <p className="pv-form-fine">
        Mit dem Absenden verarbeiten wir deine Angaben, um deine Anfrage zu beantworten. Mehr dazu
        in der <SiteLink href="/policies/privacy-policy">Datenschutzerklärung</SiteLink>.
      </p>
      <div>
        <SubmitButton pendingLabel="Wird gesendet …">Anfrage senden</SubmitButton>
      </div>
    </form>
  );
}

export default PartnerForm;
