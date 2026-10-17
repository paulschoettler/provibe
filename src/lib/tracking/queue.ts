import { isTrackingEventName, type TrackingEvent } from "./schema";

/**
 * Warteschlange für Events aus Server Actions (Kasse, Newsletter, Partnerformular): Der Server
 * legt sie, nur mit Marketing-Einwilligung, in den kurzlebigen Cookie pv_track_q; der Browser
 * liest sie einmal aus, sendet und löscht den Cookie. Rein und getestet (queue.test.ts).
 */

/**
 * Diese Events dürfen über die Warteschlange kommen; alles andere entsteht im Browser. purchase
 * fehlt bewusst: Der Kauf kommt aus dem Webhook (ohne Browser) und wird serverseitig protokolliert,
 * die Bestätigungsseite trägt einen Zugangs-Token in der Adresse (paths.ts).
 */
const QUEUE_EVENTS = new Set<TrackingEvent["event"]>([
  "begin_checkout",
  "add_shipping_info",
  "add_payment_info",
  "sign_up",
  "generate_lead",
]);

/** Browser-Grenze je Cookie ist 4 KB; mit URL-Kodierung bleibt so genug Luft. */
export const QUEUE_MAX_CHARS = 2400;
const MAX_EVENTS = 3;
const MAX_ITEMS = 12;

function trimItems(event: TrackingEvent): TrackingEvent {
  if (!("ecommerce" in event)) return event;
  return {
    ...event,
    ecommerce: { ...event.ecommerce, items: event.ecommerce.items.slice(0, MAX_ITEMS) },
  } as TrackingEvent;
}

/** Hängt ein Event an und kürzt, bis der Wert sicher in einen Cookie passt. */
export function encodeQueue(existing: TrackingEvent[], next: TrackingEvent): string | null {
  if (!QUEUE_EVENTS.has(next.event)) return null;
  let events = [...existing.filter((e) => e.event_id !== next.event_id), trimItems(next)].slice(
    -MAX_EVENTS,
  );
  let json = JSON.stringify(events);
  while (encodeURIComponent(json).length > QUEUE_MAX_CHARS && events.length > 1) {
    events = events.slice(1);
    json = JSON.stringify(events);
  }
  if (encodeURIComponent(json).length > QUEUE_MAX_CHARS) {
    // Ein einzelnes, sehr großes Event: Artikel weglassen, Wert und ID bleiben
    const only = events[0];
    const slim =
      "ecommerce" in only
        ? ({ ...only, ecommerce: { ...only.ecommerce, items: [] } } as TrackingEvent)
        : only;
    json = JSON.stringify([slim]);
    if (encodeURIComponent(json).length > QUEUE_MAX_CHARS) return null;
  }
  return json;
}

/** Liest den Cookie-Wert defensiv: unbekannte oder kaputte Einträge fallen weg. */
export function decodeQueue(raw: string | null | undefined): TrackingEvent[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      parsed = JSON.parse(decodeURIComponent(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (e): e is TrackingEvent =>
        !!e &&
        typeof e === "object" &&
        isTrackingEventName((e as { event?: unknown }).event) &&
        QUEUE_EVENTS.has((e as TrackingEvent).event) &&
        typeof (e as TrackingEvent).event_id === "string" &&
        (e as TrackingEvent).event_id.length <= 120 &&
        (!("ecommerce" in e) ||
          (typeof (e as { ecommerce: { value?: unknown } }).ecommerce?.value === "number" &&
            Array.isArray((e as { ecommerce: { items?: unknown } }).ecommerce?.items))),
    )
    .slice(-MAX_EVENTS);
}
