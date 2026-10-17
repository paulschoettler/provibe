"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, Honeypot, Notice, Select, SubmitButton, Textarea } from "@/components/forms";
import { SiteLink } from "@/components/layout/SiteLink";
import { submitContactForm } from "@/lib/forms/contact";
import { CONTACT_SUBJECTS } from "@/lib/forms/schemas";
import { FORM_ERROR_TITLE, INITIAL_FORM_STATE } from "@/lib/forms/state";
import { InhaltIcon } from "./Decor";

/**
 * Kontaktformular (Figma 26:3113, Fehlerzustand 26:3500). Ohne JavaScript normales Absenden
 * mit Redirect auf /pages/contact/gesendet, mit JavaScript Fehler ohne Neuladen.
 */
export function ContactForm() {
  const [state, action] = useActionState(submitContactForm, INITIAL_FORM_STATE);
  const errorRef = useRef<HTMLDivElement>(null);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  return (
    <form action={action} className="pv-form-card" noValidate aria-labelledby="kontakt-form-titel">
      <h2 id="kontakt-form-titel" className="pv-form-card-title lg:!text-[26px]">
        Schreib uns
      </h2>

      {state.status === "error" ? (
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          <Notice variant="error" title={FORM_ERROR_TITLE}>
            <p>{state.message}</p>
          </Notice>
        </div>
      ) : null}

      <div className="pv-form-grid pv-form-grid--2">
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
        <Field
          name="email"
          type="email"
          label="E-Mail"
          placeholder="deine@email.de"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={254}
          defaultValue={v.email}
          error={e.email}
        />
      </div>
      <Select
        name="subject"
        label="Betreff"
        options={[...CONTACT_SUBJECTS]}
        required
        defaultValue={v.subject}
        error={e.subject}
      />
      <Textarea
        name="message"
        label="Nachricht"
        placeholder="Worum geht es?"
        required
        maxLength={4000}
        defaultValue={v.message}
        error={e.message}
      />
      <Honeypot />
      <p className="pv-form-required">Alle Felder sind Pflichtfelder.</p>
      <p className="pv-form-fine">
        Mit dem Absenden verarbeiten wir deine Angaben, um dir zu antworten. Mehr dazu in der{" "}
        <SiteLink href="/policies/privacy-policy">Datenschutzerklärung</SiteLink>.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Wird gesendet …">Nachricht senden</SubmitButton>
        <span className="pv-time-pill">
          <InhaltIcon name="clock" size={18} />
          Antwort innerhalb von 24 Stunden
        </span>
      </div>
    </form>
  );
}

export default ContactForm;
