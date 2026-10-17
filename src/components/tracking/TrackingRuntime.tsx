"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useCart } from "@/components/cart/cart-context";
import { readConsentRaw, serverConsentRaw, subscribeConsent } from "@/components/consent/store";
import { buildBeginCheckoutFromCart, buildViewCartEvent } from "@/lib/tracking/builders";
import type { PublicTrackingConfig } from "@/lib/tracking/config";
import { parseConsent } from "@/lib/tracking/consent";
import { isSensitivePath } from "@/lib/tracking/paths";
import { decodeQueue } from "@/lib/tracking/queue";
import { QUEUE_COOKIE } from "@/lib/tracking/vendors";
import { syncTracking, track, trackPageView } from "./track";

/** Events aus Server Actions (Cookie pv_track_q) einmal senden und den Cookie löschen. */
function flushQueue() {
  if (isSensitivePath(window.location.pathname)) return;
  const match = document.cookie.match(new RegExp(`(?:^|; )${QUEUE_COOKIE}=([^;]*)`));
  if (!match) return;
  document.cookie = `${QUEUE_COOKIE}=; Max-Age=0; Path=/`;
  let raw = match[1];
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return;
  }
  for (const event of decodeQueue(raw)) track(event);
}

/**
 * Verbindet Einwilligung, Einstellungen und Seitenwechsel mit der Tracking-Schicht:
 * page_view je Pfad, begin_checkout auf /checkout und view_cart auf /cart aus dem Warenkorb,
 * Events aus Server Actions aus der Warteschlange. Rendert nichts.
 */
export function TrackingRuntime({ config }: { config: PublicTrackingConfig }) {
  const pathname = usePathname();
  const { cart } = useCart();
  const raw = useSyncExternalStore(subscribeConsent, readConsentRaw, serverConsentRaw);
  const consent = useMemo(() => (raw === null ? undefined : parseConsent(raw)), [raw]);
  const lastPath = useRef<string | null>(null);
  const viewCartSent = useRef(false);

  // Einwilligung oder Einstellungen geändert: Dienste laden oder widerrufen
  useEffect(() => {
    if (consent === undefined) return; // noch der Server-Snapshot während der Hydration
    syncTracking(config, consent);
  }, [config, consent]);

  // Seitenaufruf und Warteschlange je Pfad
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackPageView();
    flushQueue();
  }, [pathname]);

  // Formulare mit Server Actions ohne Seitenwechsel (Newsletter, Zahlart): kurz danach nachsehen
  useEffect(() => {
    const timers: number[] = [];
    const onSubmit = () => {
      for (const delay of [800, 2000, 5000]) timers.push(window.setTimeout(flushQueue, delay));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") flushQueue();
    };
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("visibilitychange", onVisible);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // Kasse und Warenkorbseite: Daten aus dem serverseitig gerechneten Warenkorb
  const cartId = cart.id;
  const lineCount = cart.lines.length;
  useEffect(() => {
    if (pathname !== "/cart") viewCartSent.current = false;
  }, [pathname]);
  useEffect(() => {
    if (!cartId || lineCount === 0) return;
    if (pathname === "/checkout") track(buildBeginCheckoutFromCart(cartId, cart.lines));
    if (pathname === "/cart" && !viewCartSent.current) {
      viewCartSent.current = true;
      track(buildViewCartEvent(cart.lines));
    }
    // cart.lines absichtlich nicht als Abhängigkeit: nur beim Betreten der Seite senden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, cartId, lineCount]);

  return null;
}

export default TrackingRuntime;
