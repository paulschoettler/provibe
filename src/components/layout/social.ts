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

/**
 * Zahlarten im Checkout. Als Textbadges, nicht als Markenlogos: fremde Logos dürfen wir
 * nicht von fremden Servern laden und ohne Freigabe auch nicht nachbauen.
 * Shop Pay und Union Pay fallen mit Shopify weg.
 */
export const PAYMENT_METHODS = [
  "Visa",
  "Mastercard",
  "Maestro",
  "American Express",
  "Apple Pay",
  "Google Pay",
  "PayPal",
  "Klarna",
];
