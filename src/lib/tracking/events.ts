import "server-only";
import { emitServerEvent } from "./server";
import type { TrackingEvent } from "./schema";

/**
 * Serverseitiger Einstieg der Tracking-Schicht (Briefing Abschnitt 6). Die Aufrufer im Checkout,
 * im Newsletter und im Partnerformular importieren von hier; Schema und Builder liegen in
 * schema.ts und builders.ts, damit auch Client-Komponenten sie nutzen können, ohne Server-Code
 * zu bündeln.
 *
 * Ablauf von emitTrackingEvent:
 *   1. Protokoll in tracking_events (recordServerEvent, Vorbereitung Conversions API, kein Versand)
 *   2. In Server Actions und nur mit Marketing-Einwilligung: Ablage im Cookie pv_track_q, der
 *      Browser sendet das Event dann an die eingewilligten Dienste (src/components/tracking).
 * Wirft nie, eine Bestellung oder Anmeldung scheitert nicht am Tracking.
 */

export * from "./schema";
export {
  buildCheckoutEvent,
  buildGenerateLeadEvent,
  buildPurchaseEvent,
  buildSignUpEvent,
  type TrackingSource,
} from "./builders";

/** Gibt das Event zurück, damit Aufrufer es testen oder weiterreichen können. */
export async function emitTrackingEvent<T extends TrackingEvent>(event: T): Promise<T> {
  try {
    return await emitServerEvent(event);
  } catch (error) {
    console.error("[tracking] emitTrackingEvent fehlgeschlagen", event.event, error);
    return event;
  }
}
