import { z } from "zod";

/**
 * Typisiertes Schema für shop_settings (Schlüssel/Wert-Tabelle). Jeder Abschnitt hat ein Zod-Schema
 * in camelCase und eine feste Abbildung auf Schlüssel und Sichtbarkeit (is_public). Öffentliche
 * Einstellungen liest die Storefront per RLS, interne nur der Server.
 * Rein, getestet in schema.test.ts.
 */

const opt = (schema: z.ZodString) => schema.or(z.literal("")).default("");
const email = z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse ein.");
const phone = z
  .string()
  .trim()
  .max(40)
  .regex(/^\+?[0-9 ()/-]{5,}$/, "Bitte gib eine gültige Telefonnummer ein (am besten mit +49).");
const httpsUrl = z
  .string()
  .trim()
  .url("Bitte gib eine vollständige URL ein.")
  .refine((v) => v.startsWith("https://"), "Nur https-Links.");

export const shopSchema = z.object({
  name: z.string().trim().min(1, "Bitte gib den Shopnamen ein.").max(80),
  tagline: z.string().trim().max(120).default(""),
  defaultDeliveryTime: z.string().trim().min(1, "Bitte gib eine Lieferzeit an.").max(60),
  depositDefaultCents: z.coerce.number().int().min(0).max(1000),
});

export const legalEntitySchema = z.object({
  name: z.string().trim().min(2, "Bitte gib den Firmennamen ein.").max(200),
  street: z.string().trim().min(3).max(200),
  zip: z
    .string()
    .trim()
    .regex(/^\d{4,5}$/, "Bitte gib eine gültige Postleitzahl ein."),
  city: z.string().trim().min(2).max(100),
  country: z.string().trim().length(2).toUpperCase().default("DE"),
  managingDirector: z.string().trim().min(2, "Geschäftsführung ist Pflicht im Impressum.").max(200),
  vatId: opt(
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}[0-9A-Z]{2,12}$/, "Ungültige USt-IdNr."),
  ),
  register: z.string().trim().max(200).default(""),
  phone: opt(phone),
  email,
  /** LUCID-Registrierungsnummer (Verpackungsregister), leer bis sie vorliegt (B13, H8) */
  lucidNumber: opt(
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^DE\d{10,15}$/, "LUCID-Nummer im Format DE und Ziffern."),
  ),
});

export const contactSchema = z.object({
  email,
  supportEmail: email,
  partnerEmail: email,
  phone: opt(phone),
});

export const socialSchema = z.object({
  instagram: opt(httpsUrl),
  tiktok: opt(httpsUrl),
});

export const trackingSchema = z
  .object({
    metaEnabled: z.boolean().default(false),
    metaPixelId: opt(
      z
        .string()
        .trim()
        .regex(/^\d{10,20}$/, "Meta-Pixel-IDs bestehen aus Ziffern."),
    ),
    googleEnabled: z.boolean().default(false),
    ga4MeasurementId: opt(
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^G-[A-Z0-9]{4,16}$/, "Format G-XXXXXXXXXX."),
    ),
    googleAdsConversionId: opt(
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^AW-\d{6,14}$/, "Format AW-123456789."),
    ),
    googleAdsLabels: z
      .record(z.string().regex(/^[a-z_]{2,40}$/), z.string().trim().max(60))
      .default({}),
    tiktokEnabled: z.boolean().default(false),
    tiktokPixelId: opt(
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9]{10,30}$/, "TikTok-Pixel-IDs bestehen aus Buchstaben und Ziffern."),
    ),
  })
  .refine((v) => !v.metaEnabled || v.metaPixelId, {
    message: "Ohne Pixel-ID lässt sich Meta nicht einschalten.",
    path: ["metaPixelId"],
  })
  .refine((v) => !v.googleEnabled || v.ga4MeasurementId || v.googleAdsConversionId, {
    message: "Ohne Mess-ID lässt sich Google nicht einschalten.",
    path: ["ga4MeasurementId"],
  })
  .refine((v) => !v.tiktokEnabled || v.tiktokPixelId, {
    message: "Ohne Pixel-ID lässt sich TikTok nicht einschalten.",
    path: ["tiktokPixelId"],
  });

/** Button-Lösung § 312j BGB: nur eindeutige Beschriftungen. */
export const checkoutSchema = z.object({
  buttonLabel: z.enum(["Zahlungspflichtig bestellen", "Jetzt kaufen", "Kaufen"]),
});

export const seoSchema = z.object({
  defaultTitleSuffix: z.string().max(40).default(" | provibe"),
  defaultDescription: z.string().trim().max(320).default(""),
});

/** Interne Versandsteuerung: Allowlist bis zum Go-live (nur Owner). */
export const emailSchema = z.object({
  allowlistActive: z.boolean(),
});

export const SETTINGS_SECTIONS = {
  shop: shopSchema,
  legalEntity: legalEntitySchema,
  contact: contactSchema,
  social: socialSchema,
  tracking: trackingSchema,
  checkout: checkoutSchema,
  seo: seoSchema,
  email: emailSchema,
} as const;

export type SettingsSection = keyof typeof SETTINGS_SECTIONS;
export type SectionValue<S extends SettingsSection> = z.infer<(typeof SETTINGS_SECTIONS)[S]>;

export const SECTION_LABELS: Record<SettingsSection, string> = {
  shop: "Shopdaten",
  legalEntity: "Rechtsträger",
  contact: "Kontakt",
  social: "Social Media",
  tracking: "Tracking",
  checkout: "Checkout",
  seo: "SEO",
  email: "E-Mail-Versand",
};

/** Hinweise für die Oberfläche. */
export const SECTION_HINTS: Partial<Record<SettingsSection | "invoices", string>> = {
  tracking:
    "Alle Tracking-Skripte laden nur mit Einwilligung im Consent-Banner (TDDDG). Ohne Einwilligung wird nichts geladen und kein Cookie gesetzt. Das Server-HTML enthält keine Tracking-Skripte.",
  invoices:
    "Rechnungsnummern vergibt Lexware Office aus dem eigenen Nummernkreis (H21). Der Shop vergibt keine eigenen Nummern.",
  email:
    "Bis zum Go-live gehen Newsletter und Automationen nur an die Allowlist (@provibe-drinks.de, mail@paulschoettler.de).",
  legalEntity:
    "Erscheint im Impressum, in jeder E-Mail und auf Rechnungen. LUCID-Nummer laut Verpackungsgesetz.",
};

export interface SettingRow {
  key: string;
  value: unknown;
  is_public: boolean;
}

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};
const s = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const b = (v: unknown, d = false) => (typeof v === "boolean" ? v : d);

/** Abschnitt in Datenbankzeilen (Schlüssel, JSON-Wert, Sichtbarkeit). */
export function sectionToRows<S extends SettingsSection>(
  section: S,
  value: SectionValue<S>,
): SettingRow[] {
  const v = value as Rec;
  switch (section) {
    case "shop":
      return [
        { key: "shop.name", value: v.name, is_public: true },
        { key: "shop.tagline", value: v.tagline, is_public: true },
        { key: "shop.default_delivery_time", value: v.defaultDeliveryTime, is_public: true },
        { key: "shop.deposit_default_cents", value: v.depositDefaultCents, is_public: true },
      ];
    case "legalEntity":
      return [
        {
          key: "shop.legal_entity",
          is_public: true,
          value: {
            name: v.name,
            street: v.street,
            zip: v.zip,
            city: v.city,
            country: v.country,
            managing_director: v.managingDirector,
            vat_id: v.vatId,
            register: v.register,
            phone: v.phone,
            email: v.email,
            lucid_number: v.lucidNumber,
          },
        },
      ];
    case "contact":
      return [
        {
          key: "shop.contact",
          is_public: true,
          value: {
            email: v.email,
            support_email: v.supportEmail,
            partner_email: v.partnerEmail,
            phone: v.phone,
          },
        },
      ];
    case "social":
      return [
        {
          key: "shop.social",
          is_public: true,
          value: { instagram: v.instagram, tiktok: v.tiktok },
        },
      ];
    case "tracking":
      return [
        {
          key: "tracking",
          is_public: true,
          value: {
            meta_enabled: v.metaEnabled,
            meta_pixel_id: v.metaPixelId,
            google_enabled: v.googleEnabled,
            ga4_measurement_id: v.ga4MeasurementId,
            google_ads_conversion_id: v.googleAdsConversionId,
            google_ads_labels: v.googleAdsLabels,
            tiktok_enabled: v.tiktokEnabled,
            tiktok_pixel_id: v.tiktokPixelId,
          },
        },
      ];
    case "checkout":
      return [{ key: "checkout.button_label", value: v.buttonLabel, is_public: true }];
    case "seo":
      return [
        { key: "seo.default_title_suffix", value: v.defaultTitleSuffix, is_public: true },
        { key: "seo.default_description", value: v.defaultDescription, is_public: true },
      ];
    case "email":
      return [{ key: "email.allowlist_active", value: v.allowlistActive, is_public: false }];
  }
  return [];
}

/** Datenbankzeilen in alle Abschnitte (mit sicheren Standardwerten). */
export function rowsToSettings(rows: { key: string; value: unknown }[]): {
  [S in SettingsSection]: SectionValue<S>;
} {
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const le = rec(m.get("shop.legal_entity"));
  const c = rec(m.get("shop.contact"));
  const so = rec(m.get("shop.social"));
  const t = rec(m.get("tracking"));
  const labels = rec(t.google_ads_labels);
  const deposit = Number(m.get("shop.deposit_default_cents"));
  return {
    shop: {
      name: s(m.get("shop.name"), "provibe"),
      tagline: s(m.get("shop.tagline")),
      defaultDeliveryTime: s(m.get("shop.default_delivery_time"), "3–5 Werktage"),
      depositDefaultCents: Number.isFinite(deposit) ? deposit : 0,
    },
    legalEntity: {
      name: s(le.name),
      street: s(le.street),
      zip: s(le.zip),
      city: s(le.city),
      country: s(le.country, "DE"),
      managingDirector: s(le.managing_director),
      vatId: s(le.vat_id),
      register: s(le.register),
      phone: s(le.phone),
      email: s(le.email),
      lucidNumber: s(le.lucid_number),
    },
    contact: {
      email: s(c.email),
      supportEmail: s(c.support_email),
      partnerEmail: s(c.partner_email),
      phone: s(c.phone),
    },
    social: { instagram: s(so.instagram), tiktok: s(so.tiktok) },
    tracking: {
      // Bestehende IDs ohne Schalter gelten als eingeschaltet (Seed kannte noch keine Schalter)
      metaEnabled: b(t.meta_enabled, Boolean(s(t.meta_pixel_id))),
      metaPixelId: s(t.meta_pixel_id),
      googleEnabled: b(
        t.google_enabled,
        Boolean(s(t.ga4_measurement_id) || s(t.google_ads_conversion_id)),
      ),
      ga4MeasurementId: s(t.ga4_measurement_id),
      googleAdsConversionId: s(t.google_ads_conversion_id),
      googleAdsLabels: Object.fromEntries(
        Object.entries(labels).filter((e): e is [string, string] => typeof e[1] === "string"),
      ),
      tiktokEnabled: b(t.tiktok_enabled, Boolean(s(t.tiktok_pixel_id))),
      tiktokPixelId: s(t.tiktok_pixel_id),
    },
    checkout: {
      buttonLabel: (["Zahlungspflichtig bestellen", "Jetzt kaufen", "Kaufen"] as const).includes(
        m.get("checkout.button_label") as "Kaufen",
      )
        ? (m.get("checkout.button_label") as SectionValue<"checkout">["buttonLabel"])
        : "Zahlungspflichtig bestellen",
    },
    seo: {
      defaultTitleSuffix: s(m.get("seo.default_title_suffix"), " | provibe"),
      defaultDescription: s(m.get("seo.default_description")),
    },
    email: { allowlistActive: m.get("email.allowlist_active") !== false },
  };
}
