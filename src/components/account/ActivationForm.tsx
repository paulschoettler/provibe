"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestActivation } from "@/lib/auth/actions";
import { INITIAL_FORM_STATE } from "@/lib/auth/form-state";
import { MailIcon } from "./icons";
import { SubmitButton } from "./SubmitButton";
import { BTN_OUTLINE, CARD, Field, Honeypot, LINK_PLUM, Notice } from "./ui";

/**
 * Aktivierungslink für Shopify-Bestandskunden (/account/konto-aktivieren). defaultEmail kommt aus
 * ?email=… (Massenmail "Konto aktivieren") und belegt das Feld nur vor.
 */
export function ActivationForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, action] = useActionState(requestActivation, INITIAL_FORM_STATE);

  if (state.status === "ok") {
    return (
      <div className={`${CARD} flex flex-col gap-[18px] p-5 sm:p-7`} aria-live="polite">
        <span className="bg-pv-cream text-pv-wildberry flex size-12 items-center justify-center rounded-full">
          <MailIcon className="size-6" />
        </span>
        <h2 className="text-[26px] leading-[1.15] font-medium">Check dein Postfach</h2>
        <Notice tone="success" role="status" title="Aktivierungslink unterwegs">
          {state.email
            ? `Falls wir ${state.email} kennen, bekommst du gleich eine Mail mit deinem Link.`
            : "Du bekommst gleich eine Mail mit deinem Link."}{" "}
          Er gilt 15 Minuten.
        </Notice>
        <p className="text-[14px] leading-[1.5]">
          Nichts angekommen? Schau im Spam-Ordner nach oder fordere den Link neu an.
        </p>
        {state.email ? (
          <form action={action}>
            <input type="hidden" name="email" value={state.email} />
            <SubmitButton className={`${BTN_OUTLINE} w-full`} pendingLabel="Wird gesendet …">
              Link erneut senden
            </SubmitButton>
          </form>
        ) : null}
        <Link href="/account/konto-aktivieren" className={`${LINK_PLUM} self-center text-[14px]`}>
          Andere E-Mail-Adresse verwenden
        </Link>
      </div>
    );
  }

  return (
    <div className={`${CARD} flex flex-col gap-[18px] p-5 sm:p-7`}>
      <h2 className="text-[26px] leading-[1.15] font-medium">Konto aktivieren</h2>
      <p className="text-[15px] leading-[1.5]">
        Gib die E-Mail-Adresse ein, mit der du bisher bei uns bestellt hast. Wir schicken dir einen
        Link, mit dem du dich direkt anmeldest.
      </p>
      <form action={action} className="flex flex-col gap-[18px]" noValidate>
        {state.status === "error" && !state.fieldErrors?.email ? (
          <Notice tone="error" role="alert">
            {state.message}
          </Notice>
        ) : null}
        <Field
          idPrefix="ak"
          name="email"
          type="email"
          label="E-Mail"
          placeholder="deine@email.de"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email ?? defaultEmail}
          error={state.fieldErrors?.email}
        />
        <input type="hidden" name="next" value="/account" />
        <Honeypot idPrefix="ak" />
        <SubmitButton className="btn-primary min-h-[52px] w-full" pendingLabel="Wird gesendet …">
          Aktivierungslink senden
        </SubmitButton>
      </form>
      <p className="text-[13px] leading-[1.5]">
        Schon aktiviert?{" "}
        <Link href="/account/login" className={LINK_PLUM}>
          Zur Anmeldung
        </Link>
      </p>
    </div>
  );
}

export default ActivationForm;
