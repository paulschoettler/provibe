"use client";

import { useActionState } from "react";
import {
  deleteAccount,
  requestEmailChange,
  setNewsletter,
  setPassword,
  updateProfile,
} from "@/lib/auth/account-actions";
import { INITIAL_FORM_STATE, type AccountFormState } from "@/lib/auth/form-state";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";
import { SubmitButton } from "./SubmitButton";
import { BTN_OUTLINE, Checkbox, Field, Notice } from "./ui";

/** Formulare auf /account/daten. Jedes Formular hat seine eigene Server Action mit Zod. */

function Result({ state }: { state: AccountFormState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <Notice
      tone={state.status === "ok" ? "success" : "error"}
      role={state.status === "ok" ? "status" : "alert"}
    >
      {state.message}
    </Notice>
  );
}

export function ProfileForm({
  firstName,
  lastName,
  phone,
}: {
  firstName: string;
  lastName: string;
  phone: string;
}) {
  const [state, action] = useActionState(updateProfile, INITIAL_FORM_STATE);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <Result state={state} />
      </div>
      <Field
        idPrefix="pr"
        name="firstName"
        label="Vorname"
        autoComplete="given-name"
        required
        defaultValue={state.values?.firstName ?? firstName}
        error={e.firstName}
      />
      <Field
        idPrefix="pr"
        name="lastName"
        label="Nachname"
        autoComplete="family-name"
        defaultValue={state.values?.lastName ?? lastName}
        error={e.lastName}
      />
      <Field
        idPrefix="pr"
        name="phone"
        label="Telefon"
        type="tel"
        autoComplete="tel"
        defaultValue={state.values?.phone ?? phone}
        error={e.phone}
        className="sm:col-span-2"
      />
      <div className="sm:col-span-2">
        <SubmitButton className="btn-primary" pendingLabel="Wird gespeichert …">
          Speichern
        </SubmitButton>
      </div>
    </form>
  );
}

export function EmailForm({ current, pending }: { current: string; pending: string | null }) {
  const [state, action] = useActionState(requestEmailChange, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <p className="text-[15px] leading-[1.5]">
        Aktuell: <strong className="font-semibold break-all">{current}</strong>
      </p>
      {pending && state.status === "idle" ? (
        <Notice tone="info" title="Bestätigung ausstehend">
          Wir warten auf die Bestätigung von {pending}. Schau in beide Postfächer.
        </Notice>
      ) : null}
      <Result state={state} />
      <Field
        idPrefix="em"
        name="email"
        type="email"
        label="Neue E-Mail-Adresse"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
        hint="Wir schicken Bestätigungslinks an die alte und die neue Adresse. Erst danach gilt die neue."
      />
      <div>
        <SubmitButton className={BTN_OUTLINE} pendingLabel="Wird gesendet …">
          E-Mail ändern
        </SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm({ recovery }: { recovery: boolean }) {
  const [state, action] = useActionState(setPassword, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {recovery && state.status === "idle" ? (
        <Notice tone="info" title="Neues Passwort setzen">
          Du bist über den Link angemeldet. Setz jetzt dein neues Passwort.
        </Notice>
      ) : null}
      <Result state={state} />
      <Field
        idPrefix="pw"
        name="password"
        type="password"
        label="Neues Passwort"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        error={state.fieldErrors?.password}
        hint={`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen. Wir prüfen, ob es in bekannten Datenlecks auftaucht.`}
      />
      <Field
        idPrefix="pw"
        name="passwordRepeat"
        type="password"
        label="Passwort wiederholen"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.passwordRepeat}
      />
      <div>
        <SubmitButton className={BTN_OUTLINE} pendingLabel="Wird gespeichert …">
          Passwort speichern
        </SubmitButton>
      </div>
    </form>
  );
}

export function NewsletterForm({ state: current }: { state: "subscribed" | "pending" | "none" }) {
  const [state, action] = useActionState(setNewsletter, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Result state={state} />
      <p className="text-[15px] leading-[1.5]">
        {current === "subscribed"
          ? "Du bekommst unseren Newsletter: neue Sorten, Aktionen und ab und zu ein Rabattcode."
          : current === "pending"
            ? "Deine Anmeldung wartet noch auf die Bestätigung per E-Mail."
            : "Neue Sorten, Aktionen und ab und zu ein Rabattcode. Versprochen ohne Spam, Abmeldung jederzeit."}
      </p>
      <div className="flex flex-wrap gap-3">
        {current === "subscribed" ? (
          <SubmitButton className={BTN_OUTLINE} pendingLabel="Einen Moment …">
            Newsletter abbestellen
          </SubmitButton>
        ) : (
          <>
            <input type="hidden" name="newsletter" value="on" />
            <SubmitButton className={BTN_OUTLINE} pendingLabel="Wird gesendet …">
              {current === "pending" ? "Bestätigungslink erneut senden" : "Newsletter abonnieren"}
            </SubmitButton>
          </>
        )}
      </div>
      {current === "subscribed" ? null : (
        <p className="text-[13px] leading-[1.5]">
          Mit dem Abonnieren stimmst du dem Erhalt unseres Newsletters zu. Du bestätigst deine
          Adresse per E-Mail und kannst dich jederzeit abmelden.
        </p>
      )}
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccount, INITIAL_FORM_STATE);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.status === "error" && Object.keys(e).length === 0 ? <Result state={state} /> : null}
      <ul className="list-disc pl-5 text-[14px] leading-[1.6]">
        <li>Dein Login, deine Adressen und deine Newsletter-Anmeldung werden gelöscht.</li>
        <li>
          Bestellungen und Rechnungen bewahren wir aus steuerlichen Gründen bis zum Ende der
          gesetzlichen Frist auf, ohne Verbindung zu einem Login.
        </li>
        <li>Das lässt sich nicht rückgängig machen. Als Gast bestellen kannst du weiterhin.</li>
      </ul>
      <Checkbox
        idPrefix="del"
        name="understood"
        label="Ich habe das gelesen und will mein Konto löschen."
        error={e.understood}
      />
      <Field
        idPrefix="del"
        name="confirm"
        label="Tippe LÖSCHEN zur Bestätigung"
        required
        autoComplete="off"
        error={e.confirm}
      />
      <div>
        <SubmitButton
          className="btn-pill bg-berry hover:bg-wine text-white"
          pendingLabel="Konto wird gelöscht …"
        >
          Konto endgültig löschen
        </SubmitButton>
      </div>
    </form>
  );
}
