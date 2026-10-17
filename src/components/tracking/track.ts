import { toGoogle, toMeta, toTikTok } from "@/lib/tracking/adapters";
import type { PublicTrackingConfig } from "@/lib/tracking/config";
import { allowedVendors, type ConsentState, type MarketingVendor } from "@/lib/tracking/consent";
import { isSensitivePath, sanitizeLocation, sanitizePath } from "@/lib/tracking/paths";
import type { TrackingEvent } from "@/lib/tracking/schema";
import { loadVendor, revokeVendor } from "./loaders";

/**
 * Browser-Teil der Tracking-Schicht. track(event) schreibt jedes Event in window.dataLayer
 * (neutral, ohne Netzwerkverkehr) und ruft die Adapter nur für Dienste auf, für die eine
 * Einwilligung vorliegt und eine ID eingetragen ist (mayLoad in src/lib/tracking/consent.ts).
 *
 * Events vor der Initialisierung oder vor der Einwilligung werden bis zum nächsten page_view
 * gepuffert. Wird die Einwilligung auf derselben Seite erteilt, bekommen neu geladene Dienste
 * page_view und die Seitenevents (zum Beispiel view_item) nachgereicht.
 */

let config: PublicTrackingConfig | null = null;
let consent: ConsentState | null = null;
let ready = false;
const loaded = new Set<MarketingVendor>();
/** Events der aktuellen Seite (page_view zuerst), zum Nachreichen nach einer Einwilligung */
let pageBuffer: { event: TrackingEvent; path: string }[] = [];
const sentIds = new Set<string>();

function randomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function sensitive(): boolean {
  return typeof window === "undefined" || isSensitivePath(window.location.pathname);
}

function send(vendor: MarketingVendor, event: TrackingEvent) {
  if (!config) return;
  try {
    if (vendor === "meta" && window.fbq) {
      const call = toMeta(event);
      if (call) window.fbq("track", call.name, call.params, { eventID: call.eventID });
    }
    if (vendor === "google" && window.gtag) {
      for (const call of toGoogle(event, config)) window.gtag(...call);
    }
    if (vendor === "tiktok" && window.ttq) {
      const call = toTikTok(event);
      if (call?.kind === "page") window.ttq.page();
      else if (call) window.ttq.track(call.name, call.params, { event_id: call.eventId });
    }
  } catch (error) {
    console.warn("[tracking] Senden fehlgeschlagen", vendor, error);
  }
}

/** Lädt Dienste mit frischer Einwilligung und reicht die Seitenevents nach. */
function applyConsent() {
  if (!ready || !config) return;
  const allowed = allowedVendors(consent, config, { sensitivePath: sensitive() });
  for (const vendor of allowed) {
    if (loaded.has(vendor)) continue;
    const id = config[vendor];
    if (!id || !loadVendor(vendor, id)) continue;
    loaded.add(vendor);
    for (const entry of pageBuffer) send(vendor, entry.event);
  }
}

/** Von ConsentProvider aufgerufen, sobald Einstellungen und Cookie bekannt sind. */
export function syncTracking(nextConfig: PublicTrackingConfig, nextConsent: ConsentState | null) {
  const previous = consent;
  config = nextConfig;
  consent = nextConsent;
  ready = true;
  // Entzogene Dienste: Anbieter informieren, Cookies löschen (das Neuladen übernimmt der Store)
  if (previous) {
    for (const vendor of previous.vendors) {
      if (!nextConsent?.vendors.includes(vendor)) {
        revokeVendor(vendor);
        loaded.delete(vendor);
      }
    }
  }
  applyConsent();
}

/** Seitenaufruf mit bereinigter Adresse (keine Tokens, nur Kampagnenparameter). */
export function trackPageView() {
  if (typeof window === "undefined") return;
  track({
    event: "page_view",
    event_id: "",
    page: {
      path: sanitizePath(window.location.pathname),
      location: sanitizeLocation(window.location.href),
      title: document.title,
    },
  });
  // Nach einem Wechsel von einer Token-Seite (ohne Dienste) auf eine normale Seite nachladen
  applyConsent();
}

export function track(input: TrackingEvent) {
  if (typeof window === "undefined") return;
  const event = {
    ...input,
    event_id: input.event_id || `${input.event}_${randomId()}`,
  } as TrackingEvent;
  if (sentIds.has(event.event_id)) return;
  sentIds.add(event.event_id);

  window.dataLayer = window.dataLayer || [];
  if ("ecommerce" in event) window.dataLayer.push({ ecommerce: null });
  const { event: name, ...payload } = event;
  window.dataLayer.push({ event: name, ...payload });

  // Seitenevents können vor page_view eintreffen (Effekte der Seite laufen vor dem Layout);
  // beim page_view bleiben Events desselben Pfads erhalten, page_view steht dann vorn.
  const path = window.location.pathname;
  if (event.event === "page_view") {
    pageBuffer = [
      { event, path },
      ...pageBuffer.filter((e) => e.path === path && e.event.event !== "page_view"),
    ];
  } else {
    pageBuffer = [...pageBuffer, { event, path }].slice(-20);
  }

  if (!ready || !config || sensitive()) return;
  for (const vendor of allowedVendors(consent, config)) {
    if (loaded.has(vendor)) send(vendor, event);
  }
}

/** Für Tests und das Neuladen nach Widerruf. */
export function trackingState() {
  return { ready, loaded: [...loaded], buffered: pageBuffer.length };
}
