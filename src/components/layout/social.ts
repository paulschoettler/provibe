/** Social-Profile aus dem alten Shop (docs/analyse.md, Abschnitt 2, "Externe Ziele"). */
export const SOCIAL_LINKS = [
  { label: "Instagram", url: "https://www.instagram.com/provibe.de" },
  { label: "TikTok", url: "https://www.tiktok.com/@provibe.de" },
] as const;

/** Fallback-Quick-Links, falls das Footer-Menü aus der Datenbank leer ist. */
export const FOOTER_QUICK_FALLBACK = [
  { label: "Impressum", url: "/pages/impressum", external: false },
  { label: "Datenschutzerklärung", url: "/pages/datenschutzerklarung", external: false },
  { label: "AGB", url: "/pages/allgemeine-geschaftsbedingungen", external: false },
  { label: "Widerruf", url: "/pages/ruckgabe-und-wiederrufsbelehrung", external: false },
  { label: "Versand", url: "/pages/versand", external: false },
  { label: "Vertrag widerrufen", url: "/pages/widerruf-formular", external: false },
];

/** Hauptnavigation als Fallback, falls das Menü aus der Datenbank leer ist. */
export const MAIN_MENU_FALLBACK = [
  { label: "Shop", url: "/collections/all", external: false },
  { label: "Über uns", url: "/pages/uber-uns", external: false },
  { label: "Partner", url: "/pages/partner", external: false },
  { label: "Kontakt", url: "/pages/kontakt", external: false },
];

export interface PaymentMark {
  /** Markenname, zugleich alt-Text */
  label: string;
  /** Lokale Datei unter public/, nie von fremden Servern laden */
  src: string;
  /** Eigenmaße der SVG (viewBox), damit Breite und Höhe ohne Layout-Shift feststehen */
  width: number;
  height: number;
  /** Reine Wortmarke ohne eigene Fläche (PayPal): kleiner im Plättchen, damit der Schutzraum bleibt */
  wordmark?: boolean;
}

/**
 * Zahlarten im Footer als offizielle Zeichen, unverändert und lokal ausgeliefert.
 * Quelle, Lizenz und Nutzungsbedingungen je Zeichen: docs/zahlarten-logos.md.
 * Shop Pay und Union Pay fallen mit Shopify weg.
 */
export const PAYMENT_METHODS: PaymentMark[] = [
  { label: "Visa", src: "/images/payments/visa.svg", width: 38, height: 24 },
  { label: "Mastercard", src: "/images/payments/mastercard.svg", width: 38, height: 24 },
  { label: "Maestro", src: "/images/payments/maestro.svg", width: 38, height: 24 },
  {
    label: "American Express",
    src: "/images/payments/american-express.svg",
    width: 38,
    height: 24,
  },
  { label: "Apple Pay", src: "/images/payments/apple-pay.svg", width: 165.52, height: 105.97 },
  { label: "Google Pay", src: "/images/payments/google-pay.svg", width: 757, height: 404 },
  { label: "PayPal", src: "/images/payments/paypal.svg", width: 170, height: 48, wordmark: true },
  { label: "Klarna", src: "/images/payments/klarna.svg", width: 1448, height: 609 },
];
