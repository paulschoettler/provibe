import { describe, expect, it } from "vitest";
import { SETTINGS_SECTIONS, rowsToSettings, sectionToRows } from "./schema";

const seedRows = [
  { key: "shop.name", value: "provibe" },
  { key: "shop.tagline", value: "Eistee mit Protein" },
  {
    key: "shop.legal_entity",
    value: {
      name: "CG Projects UG (haftungsbeschränkt)",
      street: "Kurt-Viermetz-Straße 1a",
      zip: "86150",
      city: "Augsburg",
      country: "DE",
      managing_director: "Celine Grimm",
      vat_id: "DE457662597",
      register: "Amtsgericht Augsburg, HRB 41818",
      phone: "+491629231702",
      email: "hello@provibe-drinks.de",
      lucid_number: "",
    },
  },
  { key: "shop.default_delivery_time", value: "3–5 Werktage" },
  { key: "shop.deposit_default_cents", value: 25 },
  {
    key: "tracking",
    value: {
      meta_pixel_id: "1372318701489027",
      ga4_measurement_id: "",
      google_ads_labels: {},
      tiktok_pixel_id: "",
    },
  },
  { key: "email.allowlist_active", value: true },
];

describe("rowsToSettings", () => {
  it("liest den Seed mit Standardwerten", () => {
    const s = rowsToSettings(seedRows);
    expect(s.shop).toEqual({
      name: "provibe",
      tagline: "Eistee mit Protein",
      defaultDeliveryTime: "3–5 Werktage",
      depositDefaultCents: 25,
    });
    expect(s.legalEntity.managingDirector).toBe("Celine Grimm");
    expect(s.legalEntity.lucidNumber).toBe("");
    expect(s.tracking.metaEnabled).toBe(true);
    expect(s.tracking.googleEnabled).toBe(false);
    expect(s.checkout.buttonLabel).toBe("Zahlungspflichtig bestellen");
    expect(s.email.allowlistActive).toBe(true);
  });
  it("ist mit dem Schema verträglich (Rundlauf)", () => {
    const s = rowsToSettings(seedRows);
    const le = SETTINGS_SECTIONS.legalEntity.parse(s.legalEntity);
    const rows = sectionToRows("legalEntity", le);
    expect(rows).toHaveLength(1);
    expect(rows[0].is_public).toBe(true);
    expect(rowsToSettings(rows).legalEntity).toEqual(le);
  });
});

describe("neue Abschnitte", () => {
  it("haben Standardwerte und laufen rund", () => {
    const all = rowsToSettings(seedRows);
    expect(all.sender.fromEmail).toBe("bestellung@provibe-drinks.de");
    expect(all.contactPage.openingText).toContain("24 Stunden");
    const rows = sectionToRows("invoices", { introduction: "", remark: "Danke", footer: "Fuß" });
    expect(rows[0]).toMatchObject({ key: "invoice.texts", is_public: false });
    expect(rowsToSettings(rows).invoices.footer).toBe("Fuß");
    expect(SETTINGS_SECTIONS.sender.safeParse({ fromName: "p", fromEmail: "x" }).success).toBe(
      false,
    );
  });
});

describe("Schema", () => {
  it("prüft LUCID, USt-IdNr. und Postleitzahl", () => {
    const base = rowsToSettings(seedRows).legalEntity;
    expect(
      SETTINGS_SECTIONS.legalEntity.safeParse({ ...base, lucidNumber: "DE1234567890123" }).success,
    ).toBe(true);
    expect(SETTINGS_SECTIONS.legalEntity.safeParse({ ...base, lucidNumber: "123" }).success).toBe(
      false,
    );
    expect(SETTINGS_SECTIONS.legalEntity.safeParse({ ...base, zip: "8615" }).success).toBe(true);
    expect(SETTINGS_SECTIONS.legalEntity.safeParse({ ...base, zip: "abc" }).success).toBe(false);
  });
  it("lässt Tracking nur mit ID einschalten und prüft Formate", () => {
    const t = rowsToSettings(seedRows).tracking;
    expect(SETTINGS_SECTIONS.tracking.safeParse({ ...t, googleEnabled: true }).success).toBe(false);
    expect(
      SETTINGS_SECTIONS.tracking.safeParse({
        ...t,
        googleEnabled: true,
        ga4MeasurementId: "g-abc123def",
      }).success,
    ).toBe(false);
    expect(
      SETTINGS_SECTIONS.tracking.safeParse({
        ...t,
        googleEnabled: true,
        googleAdsConversionId: "aw-123456789",
        googleAdsLabels: { purchase: "AbC_d-1" },
      }).success,
    ).toBe(true);
    expect(
      SETTINGS_SECTIONS.tracking.safeParse({ ...t, googleAdsLabels: { purchase: "x y" } }).success,
    ).toBe(false);
    expect(SETTINGS_SECTIONS.tracking.safeParse({ ...t, metaPixelId: "abc" }).success).toBe(false);
  });
  it("erlaubt nur eindeutige Bestellbutton-Texte (§ 312j BGB)", () => {
    expect(SETTINGS_SECTIONS.checkout.safeParse({ buttonLabel: "Weiter" }).success).toBe(false);
    expect(SETTINGS_SECTIONS.checkout.safeParse({ buttonLabel: "Jetzt kaufen" }).success).toBe(
      true,
    );
  });
  it("legt die Allowlist als interne Einstellung ab", () => {
    expect(sectionToRows("email", { allowlistActive: true })).toEqual([
      { key: "email.allowlist_active", value: true, is_public: false },
    ]);
  });
});
