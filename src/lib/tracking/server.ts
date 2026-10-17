import "server-only";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  CONSENT_COOKIE,
  hasMarketingConsent,
  isCurrentConsent,
  parseConsent,
  type ConsentState,
} from "./consent";
import { decodeQueue, encodeQueue } from "./queue";
import { eventValue, type TrackingEvent } from "./schema";
import { QUEUE_COOKIE, QUEUE_MAX_AGE_SECONDS } from "./vendors";

/**
 * Serverseite der Tracking-Schicht.
 *
 * recordServerEvent: Vorbereitung für Meta Conversions API, TikTok Events API und GA4 Measurement
 * Protocol. Bis zur Freigabe wird NICHTS an Anbieter gesendet; jedes Event landet nur als Zeile in
 * tracking_events (Event, Wert in Cent, Bestellnummer als HMAC, Einwilligungsstand). Ein späterer
 * Sender liest die Zeilen mit consent_state = 'granted' und füllt sent_to.
 *
 * queueBrowserEvent: legt Events aus Server Actions für den Browser in pv_track_q ab, aber nur
 * mit Marketing-Einwilligung. In Server Components und Jobs gibt es keine Antwort, in die ein
 * Cookie passt; dort bleibt es beim Protokoll.
 */

type ConsentLookup = ConsentState | null | "no-request";

async function readConsent(): Promise<ConsentLookup> {
  try {
    const store = await cookies();
    return parseConsent(store.get(CONSENT_COOKIE)?.value);
  } catch {
    // Kein Request (Webhook-Job, Skript): Einwilligung unbekannt
    return "no-request";
  }
}

export async function readConsentFromRequest(): Promise<ConsentState | null> {
  const c = await readConsent();
  return c === "no-request" ? null : c;
}

/** HMAC der Bestellnummer: verknüpfbar mit der Bestellung, ohne sie im Klartext zu speichern. */
export function hashOrderNumber(orderNumber: string): string {
  const secret = serverEnv().APP_TOKEN_SECRET ?? "provibe-tracking-dev-salt";
  return createHmac("sha256", secret).update(orderNumber.trim()).digest("hex").slice(0, 32);
}

function consentColumns(consent: ConsentLookup) {
  if (consent === "no-request") {
    return { consent_state: "unknown", consent_vendors: [] as string[], consent_version: null };
  }
  const version = consent ? consent.version : null;
  if (!isCurrentConsent(consent)) {
    return { consent_state: "denied", consent_vendors: [] as string[], consent_version: version };
  }
  return {
    consent_state: consent.vendors.length > 0 ? "granted" : "denied",
    consent_vendors: consent.vendors as string[],
    consent_version: consent.version,
  };
}

/** Protokolliert ein Event idempotent (event_id ist eindeutig). Wirft nie. */
export async function recordServerEvent(
  event: TrackingEvent,
  options: { consent?: ConsentLookup; source?: "server" | "browser" } = {},
): Promise<void> {
  try {
    const consent = options.consent ?? (await readConsent());
    const value = eventValue(event);
    const orderNumber = event.event === "purchase" ? event.ecommerce.transaction_id : null;
    // tracking_events ist neu (Migration 20261017108000) und noch nicht in database.types.ts
    const db = supabaseAdmin() as unknown as {
      from: (t: string) => {
        upsert: (
          row: Record<string, unknown>,
          o: { onConflict: string; ignoreDuplicates: boolean },
        ) => PromiseLike<{ error: { message: string } | null }>;
      };
    };
    const { error } = await db.from("tracking_events").upsert(
      {
        event_name: event.event,
        event_id: event.event_id.slice(0, 120),
        source: options.source ?? "server",
        value_cents: value === null ? null : Math.round(value * 100),
        currency: value === null ? null : "EUR",
        order_number_hash: orderNumber ? hashOrderNumber(orderNumber) : null,
        ...consentColumns(consent),
      },
      { onConflict: "event_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("[tracking] Event nicht protokolliert", event.event, error);
  }
}

/** Legt ein Event für den Browser ab, nur mit Marketing-Einwilligung. Wirft nie. */
export async function queueBrowserEvent(
  event: TrackingEvent,
  consent?: ConsentLookup,
): Promise<void> {
  const c = consent ?? (await readConsent());
  if (c === "no-request" || !hasMarketingConsent(c)) return;
  try {
    const store = await cookies();
    const value = encodeQueue(decodeQueue(store.get(QUEUE_COOKIE)?.value), event);
    if (!value) return;
    store.set(QUEUE_COOKIE, value, {
      path: "/",
      maxAge: QUEUE_MAX_AGE_SECONDS,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
    });
  } catch {
    // Server Component: Cookies sind hier nicht setzbar, das Event bleibt im Protokoll
  }
}

/** Gemeinsamer Weg für Events, die auf dem Server entstehen (emitTrackingEvent in events.ts). */
export async function emitServerEvent<T extends TrackingEvent>(event: T): Promise<T> {
  const consent = await readConsent();
  await recordServerEvent(event, { consent });
  await queueBrowserEvent(event, consent);
  return event;
}
