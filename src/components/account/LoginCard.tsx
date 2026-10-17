"use client";

import type { Route } from "next";
import Link from "next/link";
import { useActionState } from "react";
import {
  loginWithPassword,
  registerWithPassword,
  requestMagicLink,
  requestPasswordReset,
} from "@/lib/auth/actions";
import { INITIAL_FORM_STATE, type AccountFormState } from "@/lib/auth/form-state";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";
import { MailIcon } from "./icons";
import { SubmitButton } from "./SubmitButton";
import { BTN_OUTLINE, CARD, Field, Honeypot, LINK_PLUM, Notice } from "./ui";

export type LoginTab = "magic" | "passwort" | "registrieren" | "vergessen";

function tabHref(tab: LoginTab, next: string): Route {
  const params = new URLSearchParams();
  if (tab !== "magic") params.set("tab", tab);
  if (next && next !== "/account") params.set("next", next);
  const qs = params.toString();
  return `/account/login${qs ? `?${qs}` : ""}` as Route;
}

/**
 * Login-Karte (Figma 29:2781 Magic Link, 29:2905 Passwort, 29:3039 Link gesendet).
 * Die Tabs sind Links (funktionieren ohne JavaScript, Zustand steht in der URL).
 */
export function LoginCard({ tab, next }: { tab: LoginTab; next: string }) {
  return (
    <div className={`${CARD} flex flex-col gap-[18px] p-5 sm:p-7`}>
      {tab === "magic" ? <MagicLinkForm next={next} /> : null}
      {tab === "passwort" ? <PasswordForm next={next} /> : null}
      {tab === "registrieren" ? <RegisterForm next={next} /> : null}
      {tab === "vergessen" ? <ResetForm next={next} /> : null}
    </div>
  );
}

function Tabs({ active, next }: { active: "magic" | "passwort"; next: string }) {
  return (
    <nav aria-label="Anmeldeart" className="pv-acc-segment">
      <Link href={tabHref("magic", next)} aria-current={active === "magic" ? "page" : undefined}>
        Magic Link
      </Link>
      <Link
        href={tabHref("passwort", next)}
        aria-current={active === "passwort" ? "page" : undefined}
      >
        Passwort
      </Link>
    </nav>
  );
}

function FormError({ state }: { state: AccountFormState }) {
  if (state.status !== "error" || !state.message) return null;
  // Feldfehler stehen am Feld; die Box nur für allgemeine Fehler
  if (state.fieldErrors && Object.keys(state.fieldErrors).length > 0) return null;
  return (
    <Notice tone="error" role="alert">
      {state.message}
    </Notice>
  );
}

function ActivationHint() {
  return (
    <Notice tone="info" title="Du hattest schon ein Konto?">
      Wir schicken dir einen Aktivierungslink. Gib dafür einfach oben die E-Mail-Adresse deines
      bisherigen Kontos ein.{" "}
      <Link href="/account/konto-aktivieren" className={LINK_PLUM}>
        Mehr zur Aktivierung
      </Link>
    </Notice>
  );
}

function FooterNote() {
  return (
    <p className="text-[13px] leading-[1.5]">
      Noch kein Konto? Das legst du nach deiner nächsten Bestellung mit einem Klick an. Oder melde
      dich einfach per Magic Link an, dein Konto entsteht dabei automatisch.
    </p>
  );
}

/** Zustand "Link gesendet" (Figma 29:3039) */
function LinkSent({
  email,
  resend,
  next,
  title = "Check dein Postfach",
  text,
}: {
  email: string;
  resend?: (formData: FormData) => void;
  next: string;
  title?: string;
  text?: string;
}) {
  return (
    <div className="flex flex-col gap-[18px]" aria-live="polite">
      <span className="bg-pv-cream text-pv-wildberry flex size-12 items-center justify-center rounded-full">
        <MailIcon className="size-6" />
      </span>
      <h2 className="text-[26px] leading-[1.15] font-medium">{title}</h2>
      <Notice tone="success" role="status" title="Link gesendet">
        {text ??
          (email
            ? `Falls es für ${email} ein Konto gibt oder eines angelegt werden kann, ist der Link unterwegs. Tipp auf den Link und du bist drin.`
            : "Tipp auf den Link in der E-Mail und du bist drin.")}{" "}
        Er gilt 15 Minuten.
      </Notice>
      <p className="text-[14px] leading-[1.5]">
        Nichts angekommen? Schau im Spam-Ordner nach oder fordere den Link neu an.
      </p>
      {resend && email ? (
        <form action={resend}>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <SubmitButton className={`${BTN_OUTLINE} w-full`} pendingLabel="Wird gesendet …">
            Link erneut senden
          </SubmitButton>
        </form>
      ) : null}
      <Link href={tabHref("magic", next)} className={`${LINK_PLUM} self-center text-[14px]`}>
        Andere E-Mail-Adresse verwenden
      </Link>
    </div>
  );
}

function MagicLinkForm({ next }: { next: string }) {
  const [state, action] = useActionState(requestMagicLink, INITIAL_FORM_STATE);
  if (state.status === "ok")
    return <LinkSent email={state.email ?? ""} resend={action} next={next} />;
  return (
    <>
      <h2 className="text-[26px] leading-[1.15] font-medium">Anmelden</h2>
      <Tabs active="magic" next={next} />
      <p className="text-[15px] leading-[1.5]">
        Wir schicken dir einen Link per E-Mail. Ein Tipp darauf und du bist drin, ganz ohne
        Passwort.
      </p>
      <form action={action} className="flex flex-col gap-[18px]" noValidate>
        <FormError state={state} />
        <Field
          idPrefix="ml"
          name="email"
          type="email"
          label="E-Mail"
          placeholder="deine@email.de"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
        />
        <input type="hidden" name="next" value={next} />
        <Honeypot idPrefix="ml" />
        <SubmitButton className="btn-primary min-h-[52px] w-full" pendingLabel="Wird gesendet …">
          Link senden
        </SubmitButton>
      </form>
      <ActivationHint />
      <FooterNote />
    </>
  );
}

function PasswordForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginWithPassword, INITIAL_FORM_STATE);
  return (
    <>
      <h2 className="text-[26px] leading-[1.15] font-medium">Anmelden</h2>
      <Tabs active="passwort" next={next} />
      <form action={action} className="flex flex-col gap-[18px]" noValidate>
        <FormError state={state} />
        <Field
          idPrefix="pw"
          name="email"
          type="email"
          label="E-Mail"
          placeholder="deine@email.de"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
        />
        <div className="flex flex-col gap-2">
          <Field
            idPrefix="pw"
            name="password"
            type="password"
            label="Passwort"
            autoComplete="current-password"
            required
            error={state.fieldErrors?.password}
          />
          <Link href={tabHref("vergessen", next)} className={`${LINK_PLUM} self-end text-[13px]`}>
            Passwort vergessen?
          </Link>
        </div>
        <input type="hidden" name="next" value={next} />
        <Honeypot idPrefix="pw" />
        <SubmitButton className="btn-primary min-h-[52px] w-full" pendingLabel="Anmeldung läuft …">
          Anmelden
        </SubmitButton>
      </form>
      <p className="text-[14px] leading-[1.5]">
        Neu hier?{" "}
        <Link href={tabHref("registrieren", next)} className={LINK_PLUM}>
          Konto mit Passwort anlegen
        </Link>
      </p>
      <ActivationHint />
    </>
  );
}

function RegisterForm({ next }: { next: string }) {
  const [state, action] = useActionState(registerWithPassword, INITIAL_FORM_STATE);
  if (state.status === "ok") {
    return (
      <LinkSent
        email={state.email ?? ""}
        next={next}
        title="Bestätige deine Adresse"
        text="Wir haben dir einen Bestätigungslink geschickt. Erst nach der Bestätigung kannst du dich mit deinem Passwort anmelden."
      />
    );
  }
  return (
    <>
      <h2 className="text-[26px] leading-[1.15] font-medium">Konto anlegen</h2>
      <p className="text-[15px] leading-[1.5]">
        Mit Passwort, wenn du magst. Ohne Passwort geht es per{" "}
        <Link href={tabHref("magic", next)} className={LINK_PLUM}>
          Magic Link
        </Link>
        .
      </p>
      <form action={action} className="flex flex-col gap-[18px]" noValidate>
        <FormError state={state} />
        <Field
          idPrefix="rg"
          name="email"
          type="email"
          label="E-Mail"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
        />
        <Field
          idPrefix="rg"
          name="password"
          type="password"
          label="Passwort"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          hint={`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen. Wir prüfen, ob es in bekannten Datenlecks auftaucht.`}
          error={state.fieldErrors?.password}
        />
        <Field
          idPrefix="rg"
          name="passwordRepeat"
          type="password"
          label="Passwort wiederholen"
          autoComplete="new-password"
          required
          error={state.fieldErrors?.passwordRepeat}
        />
        <Honeypot idPrefix="rg" />
        <SubmitButton className="btn-primary min-h-[52px] w-full" pendingLabel="Wird angelegt …">
          Konto anlegen
        </SubmitButton>
      </form>
      <Link href={tabHref("passwort", next)} className={`${LINK_PLUM} text-[14px]`}>
        Ich habe schon ein Konto
      </Link>
    </>
  );
}

function ResetForm({ next }: { next: string }) {
  const [state, action] = useActionState(requestPasswordReset, INITIAL_FORM_STATE);
  if (state.status === "ok") {
    return (
      <LinkSent
        email={state.email ?? ""}
        next={next}
        text="Falls es zu dieser Adresse ein Konto gibt, haben wir dir einen Link geschickt. Darüber meldest du dich an und setzt ein neues Passwort."
      />
    );
  }
  return (
    <>
      <h2 className="text-[26px] leading-[1.15] font-medium">Passwort vergessen?</h2>
      <p className="text-[15px] leading-[1.5]">
        Kein Problem. Wir schicken dir einen Link, mit dem du dich anmeldest und ein neues Passwort
        setzt.
      </p>
      <form action={action} className="flex flex-col gap-[18px]" noValidate>
        <FormError state={state} />
        <Field
          idPrefix="rs"
          name="email"
          type="email"
          label="E-Mail"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
        />
        <SubmitButton className="btn-primary min-h-[52px] w-full" pendingLabel="Wird gesendet …">
          Link senden
        </SubmitButton>
      </form>
      <Link href={tabHref("passwort", next)} className={`${LINK_PLUM} text-[14px]`}>
        Zurück zur Anmeldung
      </Link>
    </>
  );
}

export default LoginCard;
