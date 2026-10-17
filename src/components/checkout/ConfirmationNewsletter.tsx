"use client";

import { useActionState } from "react";
import { subscribeToNewsletter } from "@/lib/newsletter/actions";
import { NEWSLETTER_INITIAL_STATE } from "@/lib/newsletter/consent";
import { MailIcon } from "./icons";

/**
 * Newsletter-Karte der Bestellbestätigung (Figma 27:5593). Nutzt dieselbe Server Action mit
 * Double Opt-in wie der Footer; ohne JavaScript ein normales Formular.
 */
export function ConfirmationNewsletter({ email }: { email: string }) {
  const [state, action, pending] = useActionState(subscribeToNewsletter, NEWSLETTER_INITIAL_STATE);
  return (
    <section
      aria-labelledby="h-newsletter"
      className="bg-pv-cream flex flex-col gap-3.5 rounded-[26px] p-[22px]"
    >
      <MailIcon className="h-[26px] w-[26px]" />
      <h2 id="h-newsletter" className="text-[20px] leading-[1.2] font-medium">
        Zum Newsletter. Versprochen ohne Spam.
      </h2>
      <p className="text-[14px] leading-[1.5]">
        Du bekommst vorher eine Bestätigungsmail. Abmeldung jederzeit.
      </p>
      {state.status === "ok" ? (
        <p role="status" className="text-[15px] font-bold">
          {state.message}
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-3.5" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="danke-newsletter-email" className="text-[14px] font-bold">
              E-Mail
            </label>
            <input
              id="danke-newsletter-email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={email}
              required
              aria-invalid={state.status === "error" ? true : undefined}
              aria-describedby={state.status === "error" ? "danke-newsletter-fehler" : undefined}
              className="co-input"
            />
            {state.status === "error" ? (
              <p
                id="danke-newsletter-fehler"
                role="alert"
                className="text-pv-wildberry text-[13px] font-bold"
              >
                {state.message}
              </p>
            ) : null}
          </div>
          <div className="pv-honeypot" aria-hidden="true">
            <label htmlFor="danke-newsletter-website">Website</label>
            <input id="danke-newsletter-website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="border-pv-wildberry bg-pv-cream h-12 rounded-full border-2 px-[22px] text-[15px] font-bold disabled:opacity-60"
          >
            {pending ? "Einen Moment …" : "Anmelden"}
          </button>
        </form>
      )}
    </section>
  );
}
