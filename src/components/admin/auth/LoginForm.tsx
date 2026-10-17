"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/lib/admin/staff/actions";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { INITIAL_ACTION_STATE } from "@/components/admin/ui/action-state";
import { buttonClasses } from "@/components/admin/ui/Button";
import { Field } from "@/components/admin/ui/fields";
import { Icon } from "@/components/admin/ui/Icon";
import { OrDivider } from "./AuthCard";

/**
 * Login nach Figma (27:4372, Fehler 27:4419): E-Mail, Passwort, Anmelden; darunter Magic Link
 * mit derselben E-Mail. Ein Formular, die Buttons unterscheiden sich über intent.
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, INITIAL_ACTION_STATE);
  const magicSent = state.status === "ok" && state.data?.magic === true;
  const email = state.values?.email;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.status === "error" && state.message ? (
        <FormMessage tone="error" className="mb-0">
          {state.message}
        </FormMessage>
      ) : null}
      {magicSent ? (
        <FormMessage tone="success" className="mb-0">
          {state.message}
        </FormMessage>
      ) : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field
        name="email"
        label="E-Mail"
        type="email"
        autoComplete="username"
        inputMode="email"
        required
        defaultValue={email}
        error={state.fieldErrors?.email}
        key={`email-${email ?? ""}`}
      />
      <Field
        name="password"
        label="Passwort"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
      />
      <Buttons />
      <p className="text-admin-text-2 text-center text-[12px]">
        Wir schicken dir einen einmaligen Anmeldelink an deine E-Mail-Adresse.
      </p>
    </form>
  );
}

function Buttons() {
  const { pending, data } = useFormStatus();
  const intent = data?.get("intent");
  return (
    <>
      <button
        type="submit"
        name="intent"
        value="password"
        disabled={pending}
        className={buttonClasses("primary", "md", "w-full")}
      >
        {pending && intent !== "magic" ? "Wird geprüft …" : "Anmelden"}
      </button>
      <OrDivider />
      <button
        type="submit"
        name="intent"
        value="magic"
        disabled={pending}
        className={buttonClasses("secondary", "md", "w-full")}
      >
        <Icon name="link" size={16} />
        {pending && intent === "magic" ? "Wird gesendet …" : "Magic Link senden"}
      </button>
    </>
  );
}
