import type { ActiveVendorIds } from "./consent";

/**
 * Tracking-IDs: Quelle ist shop_settings, Schlüssel "tracking" (öffentlich lesbar, gepflegt im
 * Backoffice unter Einstellungen, Tracking; Abbildung in src/lib/admin/settings/schema.ts):
 *
 *   { meta_enabled, meta_pixel_id, google_enabled, google_tag_id | google_ads_conversion_id,
 *     ga4_measurement_id, google_ads_labels, tiktok_enabled, tiktok_pixel_id }
 *
 * Rückfall auf NEXT_PUBLIC_META_PIXEL_ID, NEXT_PUBLIC_GOOGLE_TAG_ID, NEXT_PUBLIC_TIKTOK_PIXEL_ID,
 * wenn in der Datenbank keine ID steht. Ein ausdrückliches *_enabled = false schaltet den Dienst
 * auch dann ab. Jede ID wird gegen ein strenges Format geprüft, weil sie in eine Skript-URL kommt.
 *
 * Google: geladen wird nur das Google-Ads-Tag (AW-…, Kategorie Marketing). Eine GA4-Mess-ID
 * (G-…) gehört zur Kategorie Statistik, für die es laut H25 noch keinen Anbieter gibt; sie wird
 * deshalb nicht geladen, bis die Kategorie freigeschaltet ist (docs/tracking.md).
 */

export interface PublicTrackingConfig extends ActiveVendorIds {
  /** Google-Ads-Conversion-Labels je Event, zum Beispiel { purchase: "AbCdEf" } */
  googleAdsLabels: Record<string, string>;
}

export const EMPTY_TRACKING_CONFIG: PublicTrackingConfig = {
  meta: null,
  google: null,
  tiktok: null,
  googleAdsLabels: {},
};

export const ID_PATTERNS = {
  meta: /^\d{10,20}$/,
  googleAds: /^AW-\d{6,14}$/,
  ga4: /^G-[A-Z0-9]{4,16}$/,
  tiktok: /^[A-Z0-9]{10,30}$/,
  adsLabel: /^[A-Za-z0-9_-]{2,60}$/,
} as const;

export interface TrackingEnv {
  NEXT_PUBLIC_META_PIXEL_ID?: string;
  NEXT_PUBLIC_GOOGLE_TAG_ID?: string;
  NEXT_PUBLIC_TIKTOK_PIXEL_ID?: string;
}

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function pick(enabled: unknown, id: string, pattern: RegExp): string | null {
  if (enabled === false) return null;
  if (!id || !pattern.test(id)) return null;
  // Ohne Schalter gilt eine eingetragene ID als eingeschaltet (wie im Backoffice, rowsToSettings)
  return enabled === true || enabled === undefined ? id : null;
}

/** Rein: Datenbankwert plus Umgebung zu den IDs, die in den Client dürfen. */
export function resolveTrackingConfig(row: unknown, env: TrackingEnv = {}): PublicTrackingConfig {
  const t = rec(row);
  const metaId = str(t.meta_pixel_id) || str(env.NEXT_PUBLIC_META_PIXEL_ID);
  const googleCandidates = [
    str(t.google_tag_id).toUpperCase(),
    str(t.google_ads_conversion_id).toUpperCase(),
    str(env.NEXT_PUBLIC_GOOGLE_TAG_ID).toUpperCase(),
  ];
  const googleId = googleCandidates.find((id) => ID_PATTERNS.googleAds.test(id)) ?? "";
  const tiktokId = (str(t.tiktok_pixel_id) || str(env.NEXT_PUBLIC_TIKTOK_PIXEL_ID)).toUpperCase();

  const google = pick(t.google_enabled, googleId, ID_PATTERNS.googleAds);
  const labels = rec(t.google_ads_labels);
  return {
    meta: pick(t.meta_enabled, metaId, ID_PATTERNS.meta),
    google,
    tiktok: pick(t.tiktok_enabled, tiktokId, ID_PATTERNS.tiktok),
    googleAdsLabels: google
      ? Object.fromEntries(
          Object.entries(labels).filter(
            (e): e is [string, string] =>
              /^[a-z_]{2,40}$/.test(e[0]) &&
              typeof e[1] === "string" &&
              ID_PATTERNS.adsLabel.test(e[1]),
          ),
        )
      : {},
  };
}

export function hasAnyVendor(config: PublicTrackingConfig | null): boolean {
  return Boolean(config && (config.meta || config.google || config.tiktok));
}
