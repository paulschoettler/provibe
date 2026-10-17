/**
 * Versanddienste und Links zur Sendungsverfolgung (reine Funktionen).
 * DHL nutzt dasselbe Muster wie src/lib/integrations/shipping (piececode).
 */

export const CARRIERS = {
  dhl: "DHL",
  deutsche_post: "Deutsche Post",
  dpd: "DPD",
  gls: "GLS",
  hermes: "Hermes",
  ups: "UPS",
  other: "Anderer Versanddienst",
} as const;

export type Carrier = keyof typeof CARRIERS;

export function isCarrier(value: string): value is Carrier {
  return Object.prototype.hasOwnProperty.call(CARRIERS, value);
}

export function carrierLabel(carrier: string): string {
  return isCarrier(carrier) ? CARRIERS[carrier] : carrier.toUpperCase();
}

/** Leerzeichen entfernen, Großbuchstaben (DHL-Nummern sind Ziffern, Auslandsnummern alphanumerisch). */
export function normalizeTrackingNumber(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function isValidTrackingNumber(value: string): boolean {
  return /^[A-Z0-9-]{6,40}$/.test(normalizeTrackingNumber(value));
}

export function dhlTrackingUrl(trackingNumber: string): string {
  return `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${encodeURIComponent(trackingNumber)}`;
}

/** Link zur Sendungsverfolgung; null bei unbekanntem Versanddienst. */
export function trackingUrl(carrier: string, trackingNumber: string): string | null {
  const n = encodeURIComponent(normalizeTrackingNumber(trackingNumber));
  switch (carrier) {
    case "dhl":
    case "deutsche_post":
      return dhlTrackingUrl(normalizeTrackingNumber(trackingNumber));
    case "dpd":
      return `https://tracking.dpd.de/status/de_DE/parcel/${n}`;
    case "gls":
      return `https://gls-group.com/DE/de/paketverfolgung?match=${n}`;
    case "hermes":
      return `https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinformation#${n}`;
    case "ups":
      return `https://www.ups.com/track?loc=de_DE&tracknum=${n}`;
    default:
      return null;
  }
}
