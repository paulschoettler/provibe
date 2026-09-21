/**
 * Erzeugt Seed-Migrationen (supabase/migrations/*_seed_shopify_snapshot_part*.sql) aus dem Shopify-Snapshot (assets/source/data/shopify-snapshot) und den
 * Quelltexten (docs/quelltexte). Idempotent: nutzt feste UUIDs (uuid v5 aus Handles) und ON CONFLICT.
 *
 * Aufruf: pnpm db:seed:generate
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const snapshot = path.join(root, "assets/source/data/shopify-snapshot");
const products = JSON.parse(readFileSync(path.join(snapshot, "products.json"), "utf8"))
  .products as ShopifyProduct[];
const manifest = JSON.parse(
  readFileSync(path.join(root, "assets/source/manifest.json"), "utf8"),
) as ManifestEntry[];

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  created_at: string;
  updated_at: string;
  published_at: string;
  variants: {
    id: number;
    title: string;
    price: string;
    compare_at_price: string | null;
    sku: string | null;
    position: number;
    option1: string | null;
  }[];
  options: { name: string; position: number; values: string[] }[];
  images: { id: number; src: string; width: number; height: number; position: number }[];
}
interface ManifestEntry {
  file: string;
  source: string;
  dims: string;
  bytes: number;
}

// --- Hilfen ---------------------------------------------------------------------------------
const NS = "provibe-seed";
function uuid(...parts: string[]): string {
  const h = createHash("sha1")
    .update([NS, ...parts].join("/"))
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const q = (v: string | null | undefined) =>
  v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`;
const j = (v: unknown) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const cents = (price: string | null) =>
  price == null ? null : Math.round(parseFloat(price) * 100);
const out: string[] = [];
const emit = (s: string) => out.push(s);

function assetPath(sourceUrl: string): {
  path: string;
  width: number | null;
  height: number | null;
} {
  const base = sourceUrl.split("?")[0].split("/").pop()!;
  const m = manifest.find((e) => e.file.endsWith("/" + base));
  const [w, h] = m?.dims?.split("x").map(Number) ?? [null, null];
  return { path: `seed/${m?.file ?? "images/" + base}`, width: w ?? null, height: h ?? null };
}

// --- Stammdaten aus der Analyse --------------------------------------------------------------
const FLAVOR_DATA: Record<
  string,
  { ingredients: string; kj: number; kcal: number; sub: string; notes: string }
> = {
  wildberry: {
    sub: "Beerig, vollmundig, natürlich",
    notes: "Brombeere · Heidelbeere · Erdbeere",
    ingredients:
      "Wasser, Beta-Lactoglobulin aus <strong>Kuhmilch</strong> (Molkenprotein), 4,4 % schwarzer Johannisbeersaft aus schwarzem Johannisbeersaftkonzentrat, 1,6 % Limettensaft aus Limettensaftkonzentrat, natürliche Aromen, färbendes Lebensmittel (Konzentrat aus Karotte und Heidelbeere), Süßungsmittel (Sucralose).",
    kj: 91,
    kcal: 22,
  },
  "raspberry-lime": {
    sub: "Fruchtig-spritzig mit Limette",
    notes: "Himbeere · spritzige Limette",
    ingredients:
      "Wasser, Beta-Lactoglobulin aus <strong>Kuhmilch</strong> (Molkenprotein), 3,8 % Himbeersaft aus Himbeersaftkonzentrat, 3,5 % Limettensaft aus Limettensaftkonzentrat, natürliche Aromen, färbendes Lebensmittel (Konzentrat aus Süßkartoffel, Rettich und Apfel), Süßungsmittel (Sucralose).",
    kj: 86,
    kcal: 20,
  },
  peach: {
    sub: "Der Klassiker: saftiger Pfirsich",
    notes: "Saftiger Pfirsich",
    ingredients:
      "Wasser, Beta-Lactoglobulin aus <strong>Kuhmilch</strong> (Molkenprotein), 3 % Pfirsichsaft aus Pfirsichsaftkonzentrat, 1,5 % Limettensaft aus Limettensaftkonzentrat, natürliche Aromen, färbendes Lebensmittel (Konzentrat aus Karotte und Saflor), Süßungsmittel (Sucralose).",
    kj: 89,
    kcal: 21,
  },
};
const nutrition = (kj: number, kcal: number) => ({
  per: "100 ml",
  energy_kj: kj,
  energy_kcal: kcal,
  fat_g: "<0,5",
  saturated_fat_g: "<0,1",
  carbs_g: "<0,5",
  sugar_g: "<0,5",
  fibre_g: "<0,5",
  protein_g: "4,5",
  salt_g: "<0,01",
});
// Allergen: Milch bleibt (Milchprotein), Zusatz "einschließlich Laktose" entfällt, Produkt ist laktosefrei (ADR-006)
const ALLERGENS = "Milch (Molkenprotein). Laktosefrei.";
const FBO =
  "CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg, Deutschland";
const DEPOSIT = 25; // Cent je Dose, ab Go-live aktiv (Antwort B1)
const CAN_WEIGHT = 360; // g je Dose, Platzhalter (Frage C3)
const PACKAGING: Record<number, number> = { 9: 400, 12: 500, 18: 700, 24: 900, 36: 1200, 48: 1500 };
const SKU_PREFIX: Record<string, string> = {
  wildberry: "PV-WB",
  peach: "PV-PE",
  "raspberry-lime": "PV-RL",
  "provibe-eistee-mixed": "PV-MX",
};
const isTea = (h: string) => h in SKU_PREFIX;

// --- Ausgabe ------------------------------------------------------------------------------------
emit(`-- Seed aus dem Shopify-Snapshot vom 21.09.2026. Generiert von scripts/seed/generate-seed-sql.ts, nicht von Hand ändern.
-- Idempotent (feste UUIDs, ON CONFLICT). Bilder zeigen auf Pfade im Bucket product-media unter seed/...`);

// Steuersätze, Versandzonen, Einstellungen
emit(`insert into public.tax_rates (id, country_code, tax_class, rate_bp, name) values
  (${q(uuid("tax", "DE", "standard"))}, 'DE', 'standard', 1900, 'Deutschland 19 %'),
  (${q(uuid("tax", "DE", "reduced"))}, 'DE', 'reduced', 700, 'Deutschland 7 %'),
  (${q(uuid("tax", "AT", "standard"))}, 'AT', 'standard', 2000, 'Österreich 20 %'),
  (${q(uuid("tax", "AT", "reduced"))}, 'AT', 'reduced', 1000, 'Österreich 10 %')
on conflict (country_code, tax_class, valid_from) do update set rate_bp = excluded.rate_bp, name = excluded.name;`);

const zoneDE = uuid("zone", "de"),
  zoneAT = uuid("zone", "at");
emit(`insert into public.shipping_zones (id, code, name, country_codes, is_enabled, position) values
  (${q(zoneDE)}, 'de', 'Deutschland', array['DE']::char(2)[], true, 0),
  (${q(zoneAT)}, 'at', 'Österreich', array['AT']::char(2)[], false, 1)
on conflict (code) do update set name = excluded.name, country_codes = excluded.country_codes;`);
emit(`insert into public.shipping_rates (id, zone_id, name, description, price_cents, free_above_subtotal_cents, delivery_time_text, position) values
  (${q(uuid("rate", "de-standard"))}, ${q(zoneDE)}, 'DHL Paket', 'Versand innerhalb Deutschlands', 490, 5000, '3–5 Werktage', 0),
  (${q(uuid("rate", "at-standard"))}, ${q(zoneAT)}, 'DHL Paket International', 'Versand nach Österreich (vorbereitet, abgeschaltet)', 990, 8000, '4–7 Werktage', 0)
on conflict (id) do update set price_cents = excluded.price_cents, free_above_subtotal_cents = excluded.free_above_subtotal_cents, delivery_time_text = excluded.delivery_time_text;`);

const settings: [string, unknown, boolean][] = [
  ["shop.name", "provibe", true],
  ["shop.tagline", "Eistee mit Protein", true],
  [
    "shop.legal_entity",
    {
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
    true,
  ],
  [
    "shop.contact",
    {
      email: "hello@provibe-drinks.de",
      support_email: "support@provibe-drinks.de",
      partner_email: "partner@provibe-drinks.de",
      phone: "+491629231702",
    },
    true,
  ],
  [
    "shop.social",
    {
      instagram: "https://www.instagram.com/provibe.de",
      tiktok: "https://www.tiktok.com/@provibe.de",
    },
    true,
  ],
  ["shop.default_delivery_time", "3–5 Werktage", true],
  ["shop.deposit_default_cents", DEPOSIT, true],
  ["checkout.button_label", "Zahlungspflichtig bestellen", true],
  ["seo.default_title_suffix", " | provibe", true],
  [
    "seo.default_description",
    "provibe ist erfrischender Eistee mit 15 g Protein, ohne Zucker, ready to drink. Wildberry, Raspberry Lime und Peach.",
    true,
  ],
  [
    "tracking",
    {
      meta_pixel_id: "",
      ga4_measurement_id: "",
      google_ads_conversion_id: "",
      google_ads_labels: {},
      tiktok_pixel_id: "",
    },
    true,
  ],
  ["consent.banner_version", "2026-09-21", true],
  ["email.allowlist_active", true, false],
];
emit(
  `insert into public.shop_settings (key, value, is_public) values\n` +
    settings.map(([k, v, p]) => `  (${q(k)}, ${j(v)}, ${p})`).join(",\n") +
    `\non conflict (key) do nothing;`,
);

// Announcement-Bar (Ist-Stand)
emit(`insert into public.announcement_messages (id, message, position) values
  (${q(uuid("announcement", "1"))}, 'Versandkostenfrei ab 50 €', 0),
  (${q(uuid("announcement", "2"))}, '10% Rabatt auf deine Bestellung mit dem Code PRESALE10', 1)
on conflict (id) do update set message = excluded.message;`);

// Menüs (Ist-Stand)
const menus: [string, string, [string, string][]][] = [
  [
    "main",
    "Hauptnavigation",
    [
      ["Shop", "/pages/shop"],
      ["Über uns", "/pages/uber-uns"],
      ["Partner", "/pages/partner"],
      ["Kontakt", "/pages/contact"],
    ],
  ],
  [
    "footer-quick",
    "Footer Quick-Links",
    [
      ["Impressum", "/pages/impressum"],
      ["Datenschutzerklärung", "/policies/privacy-policy"],
      ["AGB", "/pages/allgemeine-geschaftsbedingungen"],
      ["Widerruf", "/pages/ruckgabe-und-wiederrufsbelehrung"],
      ["Versand", "/pages/versand"],
      ["Vertrag widerrufen", "/pages/widerruf-formular"],
    ],
  ],
];
for (const [handle, name, items] of menus) {
  const mid = uuid("menu", handle);
  emit(
    `insert into public.menus (id, handle, name) values (${q(mid)}, ${q(handle)}, ${q(name)}) on conflict (handle) do nothing;`,
  );
  emit(
    `insert into public.menu_items (id, menu_id, position, label, url) values\n` +
      items
        .map(
          ([label, url], i) =>
            `  (${q(uuid("menuitem", handle, url))}, ${q(mid)}, ${i}, ${j({ de: label })}, ${q(url)})`,
        )
        .join(",\n") +
      `\non conflict (id) do update set label = excluded.label, url = excluded.url, position = excluded.position;`,
  );
}

// Rabattcode PRESALE10
emit(`insert into public.discount_codes (id, code, title, kind, value, is_active) values
  (${q(uuid("discount", "PRESALE10"))}, 'PRESALE10', '10 % Pre-Sale-Rabatt', 'percentage', 1000, true)
on conflict (code) do nothing;`);

// Automationen (abgeschaltet)
emit(`insert into public.automations (key, name, is_enabled, config) values
  ('welcome', 'Willkommensmail nach Opt-in', false, '{"delay_minutes":5}'),
  ('abandoned_cart', 'Warenkorbabbrecher-Mail', false, '{"delay_hours":24,"requires_marketing_consent":true}'),
  ('review_request', 'Bewertungsanfrage nach Zustellung', false, '{"delay_days":7}')
on conflict (key) do nothing;`);

// Rechtstexte und Seiten aus docs/quelltexte
const legal: [string, string, string, string][] = [
  ["impressum", "/pages/impressum", "Impressum", "pages_impressum.md"],
  [
    "agb",
    "/pages/allgemeine-geschaftsbedingungen",
    "Allgemeine Geschäftsbedingungen",
    "pages_allgemeine_geschaftsbedingungen.md",
  ],
  [
    "widerruf",
    "/pages/ruckgabe-und-wiederrufsbelehrung",
    "Rückgabe- und Widerrufsbelehrung",
    "pages_ruckgabe_und_wiederrufsbelehrung.md",
  ],
  ["datenschutz", "/policies/privacy-policy", "Datenschutzerklärung", "policies_privacy_policy.md"],
  ["versand", "/pages/versand", "Versand", "pages_versand.md"],
];
for (const [kind, p, title, file] of legal) {
  const md = readFileSync(path.join(root, "docs/quelltexte", file), "utf8");
  const html = markdownishToHtml(md);
  const did = uuid("legal", kind);
  emit(
    `insert into public.legal_documents (id, kind, path) values (${q(did)}, ${q(kind)}, ${q(p)}) on conflict (kind) do nothing;`,
  );
  emit(`insert into public.legal_document_versions (id, document_id, version, title, body_html, change_note, status, effective_from)
  values (${q(uuid("legalv", kind, "1"))}, ${q(did)}, 1, ${q(title)}, ${q(html)}, 'Übernahme aus dem Shopify-Shop (Stand 21.09.2026), noch ohne Ersetzung der Shopify-Nennungen', 'draft', null)
on conflict (document_id, locale, version) do nothing;`);
}

const pages: [string, string, string, string | null, boolean][] = [
  ["shop", "shop", "Shop", "pages_shop.md", false],
  ["uber-uns", "about", "Über uns", "pages_uber_uns.md", false],
  ["partner", "partner", "Partner", "pages_partner.md", false],
  ["contact", "contact", "Kontakt", "pages_contact.md", false],
  ["messe", "investors", "Messe", "pages_messe.md", true],
  ["widerruf-formular", "withdrawal", "Widerruf", "pages_widerruf_formular.md", false],
];
for (const [handle, template, title, file, noindex] of pages) {
  const body = file
    ? markdownishToHtml(readFileSync(path.join(root, "docs/quelltexte", file), "utf8"))
    : "";
  const pid = uuid("page", handle);
  emit(
    `insert into public.pages (id, handle, template, status, noindex, show_in_sitemap) values (${q(pid)}, ${q(handle)}, ${q(template)}, 'draft', ${noindex}, ${!noindex}) on conflict (handle) do nothing;`,
  );
  emit(
    `insert into public.page_translations (page_id, locale, title, body_html) values (${q(pid)}, 'de', ${q(title)}, ${q(body)}) on conflict (page_id, locale) do nothing;`,
  );
}

// Produkte
const variantIdByShopify = new Map<number, string>();
const cupProduct = products.find((p) => p.handle === "provibe-clear-cup")!;
const shirtProduct = products.find((p) => p.handle === "provibe-shirt")!;

for (const p of products) {
  const pid = uuid("product", p.handle);
  const tea = isTea(p.handle);
  const isBundle = p.handle.startsWith("founder-bundle");
  const flavor = FLAVOR_DATA[p.handle];
  const displayTitle = p.title
    .replace(/Founder Bundle l{3}/, "Founder Bundle III")
    .replace(/Founder Bundle l{2}/, "Founder Bundle II")
    .replace(/Founder Bundle l\b/, "Founder Bundle I");
  const attributes = tea
    ? {
        lactose_free: true,
        protein_g_per_unit: 15,
        sugar_free: true,
        made_in: "DE",
        ready_to_drink: true,
      }
    : {};
  emit(`insert into public.products (id, handle, status, kind, vendor, product_type, tags, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure, weight_grams_per_unit, attributes, shopify_product_id, position, published_at)
values (${q(pid)}, ${q(p.handle)}, 'draft', ${isBundle ? "'bundle'" : "'simple'"}, 'provibe', ${q(tea ? "Eistee" : isBundle ? "Bundle" : "Merchandise")}, ${tea ? "array['eistee']" : isBundle ? "array['bundle','aktion']" : "array['merch']"}::text[], ${tea}, ${tea ? DEPOSIT : 0}, ${q(tea ? "Dose" : "Stück")}, ${tea ? "0.330" : "null"}, ${tea ? "'l'" : "'piece'"}, ${tea ? "'l'" : "'piece'"}, ${tea ? CAN_WEIGHT : p.handle === "provibe-shirt" ? 200 : p.handle === "provibe-clear-cup" ? 150 : "null"}, ${j(attributes)}, ${p.id}, ${products.indexOf(p)}, ${q(p.published_at)})
on conflict (handle) do update set shopify_product_id = excluded.shopify_product_id, attributes = excluded.attributes, deposit_cents_per_unit = excluded.deposit_cents_per_unit;`);

  const translation = {
    title: displayTitle,
    subtitle: tea
      ? p.handle === "provibe-eistee-mixed"
        ? "Alle drei Sorten in einem Paket"
        : (flavor?.sub ?? "Eistee mit 15 g Protein")
      : null,
    description_html: p.body_html || null,
    delivery_time_text: "3–5 Werktage",
    seo_title: tea ? `${displayTitle}: Eistee mit 15 g Protein` : displayTitle,
    seo_description:
      (p.body_html || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 155) || null,
    food_name: tea ? "Eistee mit Molkenprotein, mit Süßungsmittel" : null,
    ingredients_html: tea
      ? p.handle === "provibe-eistee-mixed"
        ? Object.entries(FLAVOR_DATA)
            .map(
              ([h, f]) =>
                `<p><strong>${h === "raspberry-lime" ? "Raspberry-Lime" : h[0].toUpperCase() + h.slice(1)}:</strong> ${f.ingredients}</p>`,
            )
            .join("")
        : `<p>${flavor!.ingredients}</p>`
      : null,
    allergens: tea ? ALLERGENS : null,
    nutrition: tea
      ? p.handle === "provibe-eistee-mixed"
        ? {
            per: "100 ml",
            variants: Object.fromEntries(
              Object.entries(FLAVOR_DATA).map(([h, f]) => [h, nutrition(f.kj, f.kcal)]),
            ),
          }
        : nutrition(flavor!.kj, flavor!.kcal)
      : null,
    storage_instructions: tea ? null : null, // Etikett-Text ausstehend (Frage B9)
    food_business_operator: tea ? FBO : null,
    country_of_origin: tea ? "Deutschland" : null,
  };
  emit(`insert into public.product_translations (product_id, locale, title, subtitle, description_html, delivery_time_text, seo_title, seo_description, food_name, ingredients_html, allergens, nutrition, storage_instructions, food_business_operator, country_of_origin)
values (${q(pid)}, 'de', ${q(translation.title)}, ${q(translation.subtitle)}, ${q(translation.description_html)}, ${q(translation.delivery_time_text)}, ${q(translation.seo_title)}, ${q(translation.seo_description)}, ${q(translation.food_name)}, ${q(translation.ingredients_html)}, ${q(translation.allergens)}, ${translation.nutrition ? j(translation.nutrition) : "null"}, ${q(translation.storage_instructions)}, ${q(translation.food_business_operator)}, ${q(translation.country_of_origin)})
on conflict (product_id, locale) do update set title = excluded.title, subtitle = excluded.subtitle, description_html = excluded.description_html, ingredients_html = excluded.ingredients_html, allergens = excluded.allergens, nutrition = excluded.nutrition, food_business_operator = excluded.food_business_operator;`);

  for (const o of p.options) {
    if (o.name === "Title") continue;
    const name = o.name.includes("Größe") ? "Größe" : o.name;
    emit(
      `insert into public.product_options (id, product_id, name, position, values) values (${q(uuid("option", p.handle, name))}, ${q(pid)}, ${q(name)}, ${o.position - 1}, ${"array[" + o.values.map((v) => q(v)).join(",") + "]::text[]"}) on conflict (product_id, name) do update set values = excluded.values;`,
    );
  }

  p.variants.forEach((v, i) => {
    const vid = uuid("variant", p.handle, String(v.id));
    variantIdByShopify.set(v.id, vid);
    const optionName =
      p.options[0]?.name === "Title"
        ? null
        : p.options[0]?.name.includes("Größe")
          ? "Größe"
          : p.options[0]?.name;
    const optionValues = optionName ? { [optionName]: v.title } : {};
    const unitCount = tea ? parseInt(v.title, 10) : 1;
    const title = tea ? `${unitCount} Dosen` : v.title === "Default Title" ? "Standard" : v.title;
    const sku = tea
      ? `${SKU_PREFIX[p.handle]}-${String(unitCount).padStart(2, "0")}`
      : p.handle === "provibe-shirt"
        ? `PV-SHIRT-${v.title}`
        : p.handle === "provibe-clear-cup"
          ? "PV-CUP"
          : p.handle === "founder-bundle-i"
            ? "PV-FB1"
            : p.handle === "founder-bundle-ii"
              ? `PV-FB2-${v.title}`
              : `PV-FB3-${v.title}`;
    const price = cents(v.price)!;
    // Streichpreise: Packgrößen-Referenz nicht als Streichpreis übernehmen (Antwort B3), Bundles bekommen components_sum (B4)
    const compareKind = isBundle ? "components_sum" : "none";
    const weight = tea
      ? unitCount * CAN_WEIGHT
      : p.handle === "provibe-shirt"
        ? 200
        : p.handle === "provibe-clear-cup"
          ? 150
          : 6 * CAN_WEIGHT +
            (p.handle === "founder-bundle-ii"
              ? 200
              : p.handle === "founder-bundle-iii-1"
                ? 350
                : 150);
    const packaging = tea ? (PACKAGING[unitCount] ?? 500) : isBundle ? 600 : 100;
    emit(`insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values (${q(vid)}, ${q(pid)}, ${q(sku)}, ${q(v.sku)}, ${q(title)}, ${j(optionValues)}, ${i}, ${price}, null, ${q(compareKind)}, ${unitCount}, ${weight}, ${packaging}, ${v.id})
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;`);
    emit(
      `insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values (${q(vid)}, 0, ${!isBundle}, false) on conflict (variant_id) do nothing;`,
    );
  });

  p.images.forEach((im, i) => {
    const a = assetPath(im.src);
    emit(
      `insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values (${q(uuid("image", p.handle, String(im.id)))}, ${q(pid)}, ${q(a.path)}, ${q(im.src.split("?")[0])}, ${a.width ?? "null"}, ${a.height ?? "null"}, ${j({ de: `${displayTitle}, Produktbild ${i + 1}` })}, ${i}) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;`,
    );
  });
}

// Bundle-Komponenten: je 2 Dosen jeder Sorte (aus 9er-Varianten zählen wir Dosen; Komponenten sind Einzeldosen → wir nutzen die 9er-Variante nicht,
// sondern legen je Sorte eine interne Einzeldosen-Variante an, damit Bestand auf Dosenebene geführt wird)
const teaHandles = ["peach", "wildberry", "raspberry-lime"];
for (const h of teaHandles) {
  const pid = uuid("product", h);
  const vid = uuid("variant", h, "single-can");
  emit(`insert into public.product_variants (id, product_id, sku, title, option_values, position, price_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, is_active)
values (${q(vid)}, ${q(pid)}, ${q(SKU_PREFIX[h] + "-01")}, '1 Dose (Bundle-Komponente)', ${j({ Menge: "1" })}, 99, 290, 'none', 1, ${CAN_WEIGHT}, 0, false)
on conflict (id) do nothing;`);
  emit(
    `insert into public.inventory_levels (variant_id, on_hand, track_inventory) values (${q(vid)}, 0, true) on conflict (variant_id) do nothing;`,
  );
}
const cupVid = variantIdByShopify.get(cupProduct.variants[0].id)!;
const shirtBySize = Object.fromEntries(
  shirtProduct.variants.map((v) => [v.title, variantIdByShopify.get(v.id)!]),
);
for (const bundleHandle of ["founder-bundle-i", "founder-bundle-ii", "founder-bundle-iii-1"]) {
  const bundle = products.find((p) => p.handle === bundleHandle)!;
  for (const bv of bundle.variants) {
    const bvid = variantIdByShopify.get(bv.id)!;
    const rows: [string, number][] = teaHandles.map((h) => [uuid("variant", h, "single-can"), 2]);
    if (bundleHandle !== "founder-bundle-ii") rows.push([cupVid, 1]);
    if (bundleHandle !== "founder-bundle-i") rows.push([shirtBySize[bv.title], 1]);
    emit(
      `insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity) values\n` +
        rows.map(([c, n]) => `  (${q(bvid)}, ${q(c)}, ${n})`).join(",\n") +
        `\non conflict do nothing;`,
    );
  }
}

// Kollektionen (Ist-Stand)
const collections: [string, string, string[], number][] = [
  ["eistee", "Eistee", ["provibe-eistee-mixed", "wildberry", "peach", "raspberry-lime"], 0],
  [
    "aktion",
    "Founder Bundles",
    ["founder-bundle-iii-1", "founder-bundle-i", "founder-bundle-ii"],
    1,
  ],
  [
    "alle-produkte",
    "Produkte",
    [
      "wildberry",
      "peach",
      "raspberry-lime",
      "provibe-eistee-mixed",
      "founder-bundle-ii",
      "founder-bundle-i",
      "founder-bundle-iii-1",
    ],
    2,
  ],
];
for (const [handle, title, handles, pos] of collections) {
  const cid = uuid("collection", handle);
  emit(
    `insert into public.collections (id, handle, kind, status, position) values (${q(cid)}, ${q(handle)}, 'manual', 'draft', ${pos}) on conflict (handle) do nothing;`,
  );
  emit(
    `insert into public.collection_translations (collection_id, locale, title) values (${q(cid)}, 'de', ${q(title)}) on conflict (collection_id, locale) do update set title = excluded.title;`,
  );
  emit(
    `insert into public.collection_products (collection_id, product_id, position) values\n` +
      handles.map((h, i) => `  (${q(cid)}, ${q(uuid("product", h))}, ${i})`).join(",\n") +
      `\non conflict (collection_id, product_id) do update set position = excluded.position;`,
  );
}
// /collections/all = automatisch alle aktiven Produkte
emit(
  `insert into public.collections (id, handle, kind, rules, status, position) values (${q(uuid("collection", "all"))}, 'all', 'automatic', '[{"field":"status","op":"eq","value":"active"}]', 'draft', 3) on conflict (handle) do nothing;`,
);
emit(
  `insert into public.collection_translations (collection_id, locale, title) values (${q(uuid("collection", "all"))}, 'de', 'Produkte') on conflict (collection_id, locale) do nothing;`,
);

// Startseiten-Module (Ist-Stand, Inhalte 1:1)
const modules: [string, number, unknown][] = [
  [
    "hero",
    0,
    {
      eyebrow: "Eistee mit Protein",
      headline: "Protein, das in jede Tasche passt.",
      text: "Schluss mit Shakern und Pulver. provibe ist erfrischender Eistee mit 15 g Protein – einfach kalt genießen, überall.",
      badges: ["15 g Protein", "Ohne Zucker", "Eiskalt & erfrischend"],
      cta: { label: "Jetzt entdecken", url: "/collections/all" },
      image: "seed/images/Element_9_10x_7c776464-d280-4ff9-9b5c-f78aebf50ba7.png",
    },
  ],
  [
    "bestseller",
    1,
    {
      eyebrow: "Unser Bestseller",
      product_handle: "provibe-eistee-mixed",
      details_label: "Alle Details ansehen",
    },
  ],
  [
    "flavors",
    2,
    {
      eyebrow: "Unsere Sorten",
      headline: "Such dir deinen Vibe.",
      cta: { label: "Alle ansehen", url: "/collections/all" },
      items: teaHandles.map((h) => ({
        product_handle: h,
        notes: FLAVOR_DATA[h].notes,
        image: `seed/images/provibe-${h === "raspberry-lime" ? "raspberry" : h}.png`,
      })),
    },
  ],
  [
    "story",
    3,
    {
      eyebrow: "Protein for your purse",
      headline: "Schluss mit dem pelzigen Proteingefühl.",
      text: "Keine Lust mehr auf eine 30-€-Riesendose Pulver, die nach Sport schmeckt und null erfrischt? provibe ist der erfrischendste Eistee mit 15 g Protein – ready to drink, klein genug für jede Tasche.",
      cta: { label: "Jetzt entdecken", url: "/collections/all" },
    },
  ],
  [
    "bundles",
    4,
    {
      eyebrow: "Founder Bundles",
      headline: "Alles in einem Set.",
      collection_handle: "aktion",
      badge: "Limitiertes Set",
      cta: { label: "Alle ansehen", url: "/collections/aktion" },
    },
  ],
];
emit(
  `insert into public.homepage_modules (id, kind, position, is_enabled, config) values\n` +
    modules
      .map(([k, pos, cfg]) => `  (${q(uuid("module", k))}, ${q(k)}, ${pos}, true, ${j(cfg)})`)
      .join(",\n") +
    `\non conflict (id) do update set config = excluded.config, position = excluded.position;`,
);

// Staff-Einladungen (Antwort A7)
emit(
  `insert into public.staff_invites (email, role) values ('hello@provibe-drinks.de', 'owner'), ('mail@paulschoettler.de', 'owner') on conflict (email) do nothing;`,
);

// Ausgabe als Migrationen (Briefing 9: Seed-Daten aus dem aktuellen Shop als reproduzierbare SQL-Dateien).
// Aufteilung in Teile von maximal 30 kB, damit sie auch über den Supabase-MCP anwendbar sind.
const header = out.shift()!;
const parts: string[][] = [];
let current: string[] = [];
let size = 0;
for (const st of out) {
  if (size + st.length > 30_000 && current.length > 0) {
    parts.push(current);
    current = [];
    size = 0;
  }
  current.push(st);
  size += st.length;
}
if (current.length > 0) parts.push(current);
const migrationsDir = path.join(root, "supabase/migrations");
for (const f of readdirSync(migrationsDir)) {
  if (/^20260921130\d{3}_seed_shopify_snapshot_part\d+\.sql$/.test(f))
    unlinkSync(path.join(migrationsDir, f));
}
parts.forEach((p, i) => {
  const version = `20260921130${String(i).padStart(3, "0")}`;
  writeFileSync(
    path.join(migrationsDir, `${version}_seed_shopify_snapshot_part${i + 1}.sql`),
    `${header}\n-- Teil ${i + 1} von ${parts.length}\n\n${p.join("\n\n")}\n`,
  );
});
console.log(
  `${parts.length} Seed-Migrationen geschrieben: ${out.length} Statements, ${products.length} Produkte, ${variantIdByShopify.size} Varianten`,
);

// --- sehr kleine Markdown→HTML-Umsetzung für die extrahierten Quelltexte ---------------------
function markdownishToHtml(md: string): string {
  const lines = md.split("\n");
  const html: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      html.push(`<ul>${list.map((l) => `<li>${l}</li>`).join("")}</ul>`);
      list = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === "-") {
      flush();
      continue;
    }
    const m = /^(#{1,6})\s*(.*)$/.exec(line);
    if (m) {
      flush();
      if (m[2].trim()) html.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
      continue;
    }
    if (line.startsWith("- ")) {
      list.push(inline(line.slice(2)));
      continue;
    }
    flush();
    html.push(`<p>${inline(line)}</p>`);
  }
  flush();
  return html.join("\n");
}
function inline(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_m, t: string, u: string) => `<a href="${u.replace(/"/g, "&quot;")}">${t}</a>`,
    );
}
