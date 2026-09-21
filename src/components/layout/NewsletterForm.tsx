"use client";

import { SiteLink } from "@/components/layout/SiteLink";
import { useActionState } from "react";
import { CONSENT_TEXT, NEWSLETTER_INITIAL_STATE } from "@/lib/newsletter/consent";
import { subscribeToNewsletter } from "@/lib/newsletter/actions";

/**
 * Newsletter-Anmeldung im Footer. Ohne JavaScript sendet das Formular die Server Action
 * ganz normal ab, mit JavaScript zeigt useActionState die Rückmeldung ohne Neuladen.
 */
export function NewsletterForm() {
  const [state, formAction, pending] = useActionState(
    subscribeToNewsletter,
    NEWSLETTER_INITIAL_STATE,
  );

  return (
    <form action={formAction} className="pv-newsletter" noValidate>
      <div className="pv-newsletter-row">
        <label htmlFor="newsletter-email" className="sr-only">
          E-Mail-Adresse
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="deine@mail.de"
          className="pv-newsletter-input"
          aria-describedby="newsletter-consent newsletter-status"
        />
        {/* Honeypot gegen Bots: für Menschen unsichtbar und nicht fokussierbar */}
        <div className="pv-honeypot" aria-hidden="true">
          <label htmlFor="newsletter-website">Website (bitte frei lassen)</label>
          <input
            id="newsletter-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
        <button type="submit" className="btn-primary pv-newsletter-button" disabled={pending}>
          {pending ? "Moment …" : "Anmelden"}
        </button>
      </div>

      <p id="newsletter-consent" className="pv-newsletter-consent">
        {CONSENT_TEXT}{" "}
        <SiteLink href="/pages/datenschutzerklarung" className="pv-footer-inline-link">
          Datenschutzerklärung
        </SiteLink>
        .
      </p>

      <p
        id="newsletter-status"
        role="status"
        aria-live="polite"
        className="pv-newsletter-status"
        data-state={state.status}
      >
        {state.message}
      </p>
    </form>
  );
}

export default NewsletterForm;
