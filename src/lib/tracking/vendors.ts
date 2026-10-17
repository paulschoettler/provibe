import { CONSENT_COOKIE, CONSENT_MAX_AGE_DAYS, type MarketingVendor } from "./consent";

/**
 * Anbieterangaben für Banner, Dialog und /cookie-einstellungen. Speicherdauern laut den
 * Cookie-Angaben der Anbieter (Stand Oktober 2026); vor dem Go-live mit der Datenschutzerklärung
 * (DS-15) abgleichen. Rein, im Client nutzbar.
 */

export interface VendorInfo {
  id: MarketingVendor;
  name: string;
  /** Kurzzeile unter dem Namen (Figma 75:2174) */
  short: string;
  provider: string;
  purpose: string;
  storage: string;
  privacyUrl: string;
}

export const VENDOR_INFO: Record<MarketingVendor, VendorInfo> = {
  meta: {
    id: "meta",
    name: "Meta Pixel",
    short: "Meta Platforms Ireland Ltd., Facebook und Instagram",
    provider: "Meta Platforms Ireland Ltd., Merrion Road, Dublin 4, D04 X2K5, Irland",
    purpose:
      "Werbung auf Facebook und Instagram passend ausspielen und messen, ob eine Anzeige zu einem Besuch oder Kauf geführt hat.",
    storage: "Cookies _fbp und _fbc bis 90 Tage",
    privacyUrl: "https://www.facebook.com/privacy/policy/",
  },
  google: {
    id: "google",
    name: "Google Ads",
    short: "Google Ireland Ltd., Anzeigen und Conversion-Messung",
    provider: "Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland",
    purpose:
      "Anzeigen in der Google-Suche und auf YouTube passend ausspielen und Käufe einer Anzeige zuordnen. Consent Mode v2, ohne Einwilligung wird nichts geladen.",
    storage: "Cookies _gcl_au und _gcl_aw bis 90 Tage",
    privacyUrl: "https://policies.google.com/privacy",
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok Pixel",
    short: "TikTok Technology Ltd., Anzeigen und Conversion-Messung",
    provider: "TikTok Technology Limited, 10 Earlsfort Terrace, Dublin 2, D02 T380, Irland",
    purpose:
      "Werbung auf TikTok passend ausspielen und messen, ob eine Anzeige zu einem Besuch oder Kauf geführt hat.",
    storage: "Cookies _ttp und _tt_enable_cookie bis 13 Monate",
    privacyUrl: "https://www.tiktok.com/legal/page/eea/privacy-policy/de",
  },
};

export const QUEUE_COOKIE = "pv_track_q";
export const QUEUE_MAX_AGE_SECONDS = 300;

/** Erstanbieter-Cookies der Dienste, die beim Widerruf gelöscht werden. */
export const VENDOR_COOKIES: Record<MarketingVendor, string[]> = {
  meta: ["_fbp", "_fbc"],
  google: ["_gcl_au", "_gcl_aw", "_gcl_gs", "_gcl_dc"],
  tiktok: ["_ttp", "_tt_enable_cookie", "ttcsid"],
};

/** Notwendige Cookies (§ 25 Abs. 2 Nr. 2 TDDDG), Liste aus DS-15 plus Consent-Cookie. */
export const NECESSARY_COOKIES: { name: string; purpose: string; storage: string }[] = [
  { name: "pv_cart", purpose: "Hält deinen Warenkorb", storage: "90 Tage" },
  { name: "sb-…", purpose: "Anmeldung im Kundenkonto", storage: "bis zur Abmeldung" },
  {
    name: "pv_contact_sent, pv_partner_sent, pv_withdrawal_sent",
    purpose: "Zeigt nach dem Absenden eines Formulars die Bestätigung",
    storage: "10 Minuten",
  },
  {
    name: CONSENT_COOKIE,
    purpose: "Speichert deine Cookie-Wahl",
    storage: CONSENT_MAX_AGE_DAYS === 365 ? "12 Monate" : `${CONSENT_MAX_AGE_DAYS} Tage`,
  },
];

/** Hilfscookie der Marketing-Kategorie, nur mit Einwilligung gesetzt. */
export const MARKETING_HELPER_COOKIE = {
  name: QUEUE_COOKIE,
  purpose:
    "Gibt ein Ereignis aus einem Formular (zum Beispiel Anmeldung oder Kasse) einmal an die eingewilligten Dienste weiter",
  storage: "5 Minuten",
};

export const PRIVACY_PATH = "/policies/privacy-policy";
export const IMPRINT_PATH = "/pages/impressum";
export const CONSENT_PAGE_PATH = "/cookie-einstellungen";
