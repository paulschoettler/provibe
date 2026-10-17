"use client";

import { useActionState } from "react";
import { applyDiscountAction, removeDiscountAction } from "@/lib/checkout/actions";
import { INITIAL_FORM_STATE } from "@/lib/checkout/types";
import { AlertIcon, CheckIcon } from "./icons";

/**
 * Rabattcode einlösen (Figma 26:4050). Mit JavaScript ohne Seitenwechsel, die Übersicht
 * aktualisiert sich über revalidatePath; ohne JavaScript normales Formular.
 */
export function DiscountForm({
  idPrefix,
  appliedCode,
  rejection,
  back = "/checkout",
}: {
  idPrefix: string;
  appliedCode: string | null;
  /** Grund, warum ein gespeicherter Code gerade nicht greift (z.B. Mindestbestellwert) */
  rejection?: string | null;
  back?: "/checkout" | "/checkout/zahlung";
}) {
  const [state, action, pending] = useActionState(applyDiscountAction, INITIAL_FORM_STATE);
  const [removeState, removeAction, removing] = useActionState(
    removeDiscountAction,
    INITIAL_FORM_STATE,
  );
  const fieldId = `${idPrefix}-rabattcode`;
  const error = state.fieldErrors?.code;

  if (appliedCode) {
    return (
      <form action={removeAction} className="flex flex-col gap-1.5">
        <input type="hidden" name="back" value={back} />
        <p className="text-[14px] font-semibold">Rabattcode</p>
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[15px]">
            <CheckIcon className="text-plum h-5 w-5" />
            <span>
              <strong className="font-semibold">{appliedCode}</strong>{" "}
              {rejection ? "gespeichert" : "eingelöst"}
            </span>
          </p>
          <button
            type="submit"
            disabled={removing}
            className="text-plum flex h-11 items-center text-[14px] font-semibold underline underline-offset-4"
          >
            Entfernen
          </button>
        </div>
        {rejection ? (
          <p role="status" className="text-berry text-[13px] font-semibold">
            {rejection}
          </p>
        ) : null}
        <p aria-live="polite" className="sr-only">
          {removeState.message ?? (state.status === "ok" ? state.message : "")}
        </p>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-1.5" noValidate>
      <input type="hidden" name="back" value={back} />
      <label htmlFor={fieldId} className="text-[14px] font-semibold">
        Rabattcode
      </label>
      <div className="flex items-start gap-2">
        <input
          id={fieldId}
          name="code"
          defaultValue={state.values?.code ?? ""}
          placeholder="Code eingeben"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-fehler` : undefined}
          className="co-input min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={pending}
          className="border-aubergine bg-cream h-[52px] shrink-0 rounded-full border-2 px-[22px] text-[15px] font-semibold disabled:opacity-60"
        >
          {pending ? "Prüfe …" : "Einlösen"}
        </button>
      </div>
      {error ? (
        <p
          id={`${fieldId}-fehler`}
          role="alert"
          className="text-berry flex items-center gap-1.5 text-[13px] font-semibold"
        >
          <AlertIcon className="h-4 w-4" />
          {error}
        </p>
      ) : null}
      {removeState.status === "ok" ? (
        <p aria-live="polite" className="text-[13px]">
          {removeState.message}
        </p>
      ) : null}
    </form>
  );
}
