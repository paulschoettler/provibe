"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, FieldError, Honeypot, Notice, SubmitButton, Textarea } from "@/components/forms";
import { SiteLink } from "@/components/layout/SiteLink";
import { submitReview } from "@/lib/reviews/actions";
import { RATING_LABELS, starsLabel, type RatingValue } from "@/lib/reviews/logic";
import { REVIEW_BODY_MAX, REVIEW_TITLE_MAX } from "@/lib/reviews/limits";
import { INITIAL_REVIEW_FORM_STATE } from "@/lib/reviews/types";
import { LockIcon, StarIcon } from "./icons";

const RATINGS: RatingValue[] = [1, 2, 3, 4, 5];

/**
 * Bewertungsformular je Produkt (Figma "Bewerten / Mobil" 89:1763, "Desktop" 91:1867).
 * Sterne sind echte Radio-Buttons mit Label (Pfeiltasten wählen, ohne JavaScript bedienbar),
 * die Füllung bis zur Auswahl macht CSS (Block "Bewertungen" in globals.css). Ohne JavaScript
 * normales Absenden mit Redirect, mit JavaScript Fehler ohne Neuladen.
 */
export function ReviewForm({
  token,
  productId,
  productTitle,
  defaults,
  submitLabel = "Bewertung senden",
}: {
  token: string;
  productId: string;
  productTitle: string;
  defaults?: { rating?: number; title?: string | null; body?: string | null };
  submitLabel?: string;
}) {
  const [state, action] = useActionState(submitReview, INITIAL_REVIEW_FORM_STATE);
  const errorRef = useRef<HTMLDivElement>(null);
  const e = state.fieldErrors ?? {};
  const v = state.values;
  const rating = Number(v?.rating ?? defaults?.rating ?? 0);
  const id = (name: string) => `bewertung-${productId}-${name}`;
  const starsErrorId = `${id("sterne")}-fehler`;

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  return (
    <form
      action={action}
      noValidate
      className="flex flex-col gap-5"
      aria-label={`Bewertung für ${productTitle}`}
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="productId" value={productId} />

      {state.status === "error" ? (
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          <Notice variant="error" title="Da fehlt noch was">
            <p>{state.message}</p>
          </Notice>
        </div>
      ) : null}

      <fieldset
        className="pv-stars"
        data-invalid={e.rating ? "true" : undefined}
        aria-describedby={e.rating ? starsErrorId : undefined}
      >
        <legend className="pv-form-label">Wie viele Sterne gibst du?</legend>
        <div className="pv-stars-row">
          {RATINGS.map((n) => (
            <span key={n} className="pv-star">
              <input
                className="pv-star-input"
                type="radio"
                name="rating"
                id={id(`sterne-${n}`)}
                value={n}
                required
                defaultChecked={rating === n}
              />
              <label htmlFor={id(`sterne-${n}`)} className="pv-star-label">
                <StarIcon size={28} filled={false} />
                <span className="sr-only">
                  {starsLabel(n)}: {RATING_LABELS[n]}
                </span>
              </label>
            </span>
          ))}
        </div>
        <p className="pv-stars-caption" aria-hidden="true">
          <span data-n="0">Tippe auf einen Stern.</span>
          {RATINGS.map((n) => (
            <span key={n} data-n={n}>
              {starsLabel(n)}: {RATING_LABELS[n]}
            </span>
          ))}
        </p>
        <FieldError id={starsErrorId} message={e.rating} />
      </fieldset>

      <Field
        id={id("titel")}
        name="title"
        label="Titel"
        optional
        placeholder="Zum Beispiel: Mein Gym-Begleiter"
        maxLength={REVIEW_TITLE_MAX}
        defaultValue={v?.title ?? defaults?.title ?? undefined}
        error={e.title}
      />
      <Textarea
        id={id("text")}
        name="body"
        label="Deine Bewertung"
        required
        placeholder="Wie schmeckt’s, wann trinkst du ihn, was fällt dir auf?"
        maxLength={REVIEW_BODY_MAX}
        defaultValue={v?.body ?? defaults?.body ?? undefined}
        error={e.body}
        hint="Mindestens 20, höchstens 1.500 Zeichen."
      />
      <Honeypot id={id("hp")} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-5">
        <SubmitButton
          pendingLabel="Wird gespeichert …"
          className="shrink-0 self-start whitespace-nowrap"
        >
          {submitLabel}
        </SubmitButton>
        <p className="text-pv-wildberry m-0 flex gap-2 text-[13px] leading-[1.45]">
          <LockIcon className="text-pv-wildberry h-5 w-5 shrink-0" />
          <span>
            Dein Name erscheint gekürzt, zum Beispiel „Lena M.“. Mehr in der{" "}
            <SiteLink
              href="/policies/privacy-policy"
              className="font-medium underline underline-offset-2"
            >
              Datenschutzerklärung
            </SiteLink>
            .
          </span>
        </p>
      </div>
    </form>
  );
}

export default ReviewForm;
