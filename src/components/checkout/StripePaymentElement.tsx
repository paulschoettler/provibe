"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Stripe Payment Element (APP_INTEGRATIONS=live). @stripe/stripe-js wird erst hier und nur
 * dynamisch geladen, damit Seiten ohne Zahlung und der Mock-Betrieb kein Stripe-Skript laden.
 * Kartendaten gehen direkt vom Browser an Stripe, nie an unseren Server.
 */

export interface StripeHandle {
  /** Eingaben prüfen und Zahlung bestätigen; leitet bei Erfolg auf returnUrl weiter */
  confirm(clientSecret: string, returnUrl: string): Promise<{ error?: string }>;
  validate(): Promise<{ error?: string }>;
}

type StripeLike = {
  elements(options: Record<string, unknown>): {
    create(
      type: "payment",
      options?: Record<string, unknown>,
    ): { mount(el: HTMLElement): void; destroy(): void };
    submit(): Promise<{ error?: { message?: string } }>;
  };
  confirmPayment(options: Record<string, unknown>): Promise<{ error?: { message?: string } }>;
};

export function StripePaymentElement({
  publishableKey,
  clientSecret,
  onReady,
}: {
  publishableKey: string;
  clientSecret: string;
  onReady: (handle: StripeHandle) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let destroyed = false;
    let element: { destroy(): void } | null = null;
    (async () => {
      try {
        const { loadStripe } = await import("@stripe/stripe-js");
        const stripe = (await loadStripe(publishableKey, {
          locale: "de",
        })) as unknown as StripeLike | null;
        if (!stripe || destroyed || !mountRef.current) return;
        const elements = stripe.elements({
          clientSecret,
          appearance: {
            theme: "flat",
            variables: {
              colorPrimary: "#d9306e",
              colorText: "#4a2f39",
              colorBackground: "#ffffff",
              colorDanger: "#702249",
              borderRadius: "14px",
              fontFamily: "Jost, system-ui, sans-serif",
            },
          },
        });
        const payment = elements.create("payment", { layout: "accordion" });
        payment.mount(mountRef.current);
        element = payment;
        setStatus("ready");
        onReady({
          async validate() {
            const { error } = await elements.submit();
            return { error: error?.message };
          },
          async confirm(secret, returnUrl) {
            const { error } = await stripe.confirmPayment({
              elements,
              clientSecret: secret,
              confirmParams: { return_url: new URL(returnUrl, window.location.origin).toString() },
            });
            return { error: error?.message ?? "Die Zahlung konnte nicht bestätigt werden." };
          },
        });
      } catch {
        if (!destroyed) setStatus("error");
      }
    })();
    return () => {
      destroyed = true;
      element?.destroy();
    };
  }, [publishableKey, clientSecret, onReady]);

  return (
    <div>
      <div ref={mountRef} />
      {status === "loading" ? <p className="text-[14px]">Zahlarten werden geladen …</p> : null}
      {status === "error" ? (
        <p role="alert" className="text-berry text-[14px] font-semibold">
          Die Zahlungsfelder konnten nicht geladen werden. Bitte lade die Seite neu.
        </p>
      ) : null}
    </div>
  );
}
