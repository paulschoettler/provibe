import { ID_PATTERNS } from "@/lib/tracking/config";
import type { MarketingVendor } from "@/lib/tracking/consent";
import { VENDOR_COOKIES } from "@/lib/tracking/vendors";

/**
 * Lädt die Anbieter-Skripte dynamisch, erst nach Einwilligung und nie im Server-HTML.
 * Nachbau der offiziellen Einbettungscodes von Meta, Google (gtag) und TikTok ohne Inline-Skript.
 * Nur im Browser verwenden (aus track.ts).
 */

type AnyFn = (...args: unknown[]) => void;

interface FbqStub extends AnyFn {
  callMethod?: AnyFn;
  queue: unknown[];
  push: AnyFn;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
}

interface TtqStub extends Array<unknown> {
  methods: string[];
  setAndDefer: (target: Record<string, unknown>, method: string) => void;
  instance: (id: string) => unknown[];
  load: (id: string) => void;
  page: () => void;
  track: (name: string, params?: unknown, options?: unknown) => void;
  revokeConsent?: () => void;
  _i?: Record<string, unknown[] & { _u?: string }>;
  _t?: Record<string, number>;
  _o?: Record<string, unknown>;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    pvGoogleLayer?: unknown[];
    fbq?: FbqStub;
    _fbq?: FbqStub;
    gtag?: AnyFn;
    ttq?: TtqStub;
    TiktokAnalyticsObject?: string;
  }
}

/** Eigene dataLayer-Ebene für gtag, damit unser neutraler dataLayer nicht als Google-Befehl gilt. */
export const GOOGLE_LAYER = "pvGoogleLayer";

function injectScript(src: string, id: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

export function loadMeta(pixelId: string): boolean {
  if (!ID_PATTERNS.meta.test(pixelId)) return false;
  if (!window.fbq) {
    const n = function (...args: unknown[]) {
      if (n.callMethod) n.callMethod(...args);
      else n.queue.push(args);
    } as FbqStub;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    // Keine automatischen PageViews bei Client-Navigation: wir senden selbst (ohne Token-Pfade)
    n.disablePushState = true;
    window.fbq = n;
    if (!window._fbq) window._fbq = n;
    injectScript("https://connect.facebook.net/en_US/fbevents.js", "pv-meta-pixel");
  }
  // Keine automatische Erfassung von Klicks und Seiteninhalten
  window.fbq("set", "autoConfig", false, pixelId);
  window.fbq("init", pixelId);
  return true;
}

export function loadGoogle(tagId: string): boolean {
  if (!ID_PATTERNS.googleAds.test(tagId)) return false;
  if (!window.gtag) {
    window[GOOGLE_LAYER] = window[GOOGLE_LAYER] || [];
    window.gtag = function () {
      // gtag erwartet das arguments-Objekt, kein Array
      // eslint-disable-next-line prefer-rest-params
      window[GOOGLE_LAYER]!.push(arguments);
    };
    // Consent Mode v2: Standard alles verweigert, dann die erteilte Einwilligung (nur Werbung)
    window.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      functionality_storage: "denied",
      personalization_storage: "denied",
      security_storage: "granted",
    });
    window.gtag("consent", "update", {
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
    window.gtag("js", new Date());
    injectScript(
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}&l=${GOOGLE_LAYER}`,
      "pv-google-tag",
    );
  }
  window.gtag("config", tagId, { send_page_view: false });
  return true;
}

export function loadTikTok(pixelId: string): boolean {
  if (!ID_PATTERNS.tiktok.test(pixelId)) return false;
  if (window.ttq) return true;
  window.TiktokAnalyticsObject = "ttq";
  const ttq = [] as unknown as TtqStub;
  ttq.methods = [
    "page",
    "track",
    "identify",
    "instances",
    "debug",
    "on",
    "off",
    "once",
    "ready",
    "alias",
    "group",
    "enableCookie",
    "disableCookie",
    "holdConsent",
    "revokeConsent",
    "grantConsent",
  ];
  ttq.setAndDefer = (target, method) => {
    target[method] = (...args: unknown[]) => {
      (target as unknown as unknown[]).push([method, ...args]);
    };
  };
  for (const method of ttq.methods)
    ttq.setAndDefer(ttq as unknown as Record<string, unknown>, method);
  ttq.instance = (id: string) => {
    const instance = ttq._i?.[id] ?? [];
    for (const method of ttq.methods) {
      ttq.setAndDefer(instance as unknown as Record<string, unknown>, method);
    }
    return instance;
  };
  ttq.load = (id: string) => {
    const base = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = ttq._i || {};
    ttq._i[id] = [] as unknown[] & { _u?: string };
    ttq._i[id]._u = base;
    ttq._t = ttq._t || {};
    ttq._t[id] = Date.now();
    ttq._o = ttq._o || {};
    ttq._o[id] = {};
    injectScript(`${base}?sdkid=${encodeURIComponent(id)}&lib=ttq`, "pv-tiktok-pixel");
  };
  window.ttq = ttq;
  ttq.load(pixelId);
  return true;
}

export function loadVendor(vendor: MarketingVendor, id: string): boolean {
  if (vendor === "meta") return loadMeta(id);
  if (vendor === "google") return loadGoogle(id);
  return loadTikTok(id);
}

/** Widerruf: Anbieter informieren und deren Erstanbieter-Cookies löschen. */
export function revokeVendor(vendor: MarketingVendor) {
  try {
    if (vendor === "meta") window.fbq?.("consent", "revoke");
    if (vendor === "google") {
      window.gtag?.("consent", "update", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
    }
    if (vendor === "tiktok") window.ttq?.revokeConsent?.();
  } catch {
    // Skript noch nicht geladen: nichts zu widerrufen
  }
  const host = window.location.hostname;
  const labels = host.split(".");
  const domains = ["", host, `.${host}`];
  if (labels.length > 2) domains.push(`.${labels.slice(-2).join(".")}`);
  for (const name of VENDOR_COOKIES[vendor]) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}`;
    }
  }
}
