"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { confirmPaymentAction, startSetupAction } from "@/lib/subscriptions/actions";
import { BRAND_COLORS, BRAND_FONTS } from "@/lib/brand/tokens";

/**
 * Live-Betrieb (APP_INTEGRATIONS=live): Zahlungsmittel per Stripe SetupIntent wechseln und eine
 * offene Zahlung mit 3-D Secure bestätigen. @stripe/stripe-js lädt erst bei Bedarf. Kartendaten
 * gehen direkt an Stripe; der Server liest das Ergebnis selbst bei Stripe (finishSetupIntent,
 * Webhook), er vertraut nie den Angaben aus dem Browser.
 */

type StripeLike = {
  elements(options: Record<string, unknown>): {
    create(type: "payment", options?: Record<string, unknown>): { mount(el: HTMLElement): void };
    submit(): Promise<{ error?: { message?: string } }>;
  };
  confirmSetup(options: Record<string, unknown>): Promise<{ error?: { message?: string } }>;
  handleNextAction(options: { clientSecret: string }): Promise<{ error?: { message?: string } }>;
};

async function loadStripeJs(key: string): Promise<StripeLike | null> {
  const { loadStripe } = await import("@stripe/stripe-js");
  return (await loadStripe(key, { locale: "de" })) as unknown as StripeLike | null;
}

const APPEARANCE = {
  theme: "flat",
  variables: {
    // Stripe rendert im iframe ohne unsere CSS-Variablen: Werte aus tokens.json
    colorPrimary: BRAND_COLORS.wildberry,
    colorText: BRAND_COLORS.wildberry,
    colorBackground: BRAND_COLORS.white,
    colorDanger: BRAND_COLORS.wildberry,
    borderRadius: "14px",
    fontFamily: BRAND_FONTS.sans,
  },
};

export function StripeSetupForm({
  subscriptionId,
  publishableKey,
}: {
  subscriptionId: string;
  publishableKey: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<{
    stripe: StripeLike;
    elements: ReturnType<StripeLike["elements"]>;
    returnUrl: string;
  } | null>(null);
  const [stage, setStage] = useState<"start" | "ready">("start");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    startTransition(async () => {
      setError(null);
      const data = new FormData();
      data.set("id", subscriptionId);
      const result = await startSetupAction(data);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const stripe = await loadStripeJs(publishableKey);
      if (!stripe || !mountRef.current) {
        setError("Die Zahlungsfelder konnten nicht geladen werden.");
        return;
      }
      const elements = stripe.elements({
        clientSecret: result.clientSecret,
        appearance: APPEARANCE,
      });
      elements.create("payment", { layout: "accordion" }).mount(mountRef.current);
      stripeRef.current = { stripe, elements, returnUrl: result.returnUrl };
      setStage("ready");
    });
  }

  function save() {
    startTransition(async () => {
      const ctx = stripeRef.current;
      if (!ctx) return;
      const submitted = await ctx.elements.submit();
      if (submitted.error) {
        setError(submitted.error.message ?? "Bitte prüf deine Angaben.");
        return;
      }
      const { error: confirmError } = await ctx.stripe.confirmSetup({
        elements: ctx.elements,
        confirmParams: { return_url: new URL(ctx.returnUrl, window.location.origin).toString() },
      });
      if (confirmError)
        setError(confirmError.message ?? "Das Zahlungsmittel wurde nicht gespeichert.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div ref={mountRef} />
      {error ? (
        <p
          role="alert"
          className="border-pv-wildberry text-pv-wildberry bg-pv-white rounded-[14px] border-[1.5px] px-3 py-2 text-[14px]"
        >
          {error}
        </p>
      ) : null}
      {stage === "start" ? (
        <button type="button" onClick={start} disabled={pending} className="btn-primary">
          {pending ? "Wird geladen …" : "Neues Zahlungsmittel eingeben"}
        </button>
      ) : (
        <button type="button" onClick={save} disabled={pending} className="btn-primary">
          {pending ? "Wird gespeichert …" : "Zahlungsmittel speichern"}
        </button>
      )}
      <noscript>
        <p className="text-pv-wildberry text-[14px] font-bold">
          Zum Ändern des Zahlungsmittels brauchst du JavaScript.
        </p>
      </noscript>
    </div>
  );
}

export function ConfirmPaymentLive({
  subscriptionId,
  publishableKey,
}: {
  subscriptionId: string;
  publishableKey: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function confirm() {
    startTransition(async () => {
      setError(null);
      const data = new FormData();
      data.set("id", subscriptionId);
      const result = await confirmPaymentAction(data);
      if (result.status === "confirmed" || result.status === "nothing_pending") {
        router.push(`/account/abo/${subscriptionId}?hinweis=bezahlt` as Route);
        router.refresh();
        return;
      }
      if (result.status !== "client_action" || !result.clientSecret) {
        setError("Die Bestätigung hat nicht geklappt. Bitte versuch es noch einmal.");
        return;
      }
      const stripe = await loadStripeJs(publishableKey);
      if (!stripe) {
        setError("Stripe konnte nicht geladen werden.");
        return;
      }
      const next = await stripe.handleNextAction({ clientSecret: result.clientSecret });
      if (next.error) {
        setError(next.error.message ?? "Die Bank hat die Zahlung nicht bestätigt.");
        return;
      }
      // Die Bestellung entsteht im Webhook (payment_intent.succeeded); kurz darauf neu laden
      router.push(`/account/abo/${subscriptionId}?hinweis=bestaetigt` as Route);
      router.refresh();
    });
  }
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={confirm} disabled={pending} className="btn-primary w-full">
        {pending ? "Einen Moment …" : "Zahlung bestätigen"}
      </button>
      {error ? (
        <p role="alert" className="text-pv-wildberry text-[14px] font-bold">
          {error}
        </p>
      ) : null}
    </div>
  );
}
