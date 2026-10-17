/**
 * Shopify "Export orders" (CSV, eine Zeile je Position) zu Bestellungen mit Positionen
 * aggregieren und auf unser Modell abbilden: Varianten-Zuordnung, Pfandanteil, Status-Mapping,
 * Rabattverteilung, Steuerzeilen. Reine Funktionen, getestet in __tests__/orders.test.ts.
 *
 * Bestellwerte (Financial Status, Total, Adressen …) stehen bei Shopify nur in der ersten Zeile
 * einer Bestellung, Folgezeilen tragen Name, E-Mail und die Positionsspalten.
 */
import { depositPerItemCents } from "@/lib/cart/mapping";
import { allocateProportionally } from "@/lib/money";
import { calculateBasePrice, formatBasePrice, type UnitMeasure } from "@/lib/pricing";
import { splitStreet } from "@/lib/checkout/snapshot";
import type { RawRow } from "../lib/csv";
import {
  countryCode,
  errorMessage,
  normalizeEmail,
  nullable,
  parseIntOrNull,
  parseMoneyCents,
  parseMoneyOrZero,
  parseShopifyDate,
  parseShopifyId,
  parseTags,
  pick,
  rateBpFromTaxName,
  splitFullName,
} from "../lib/values";
import type { MapResult } from "./customers";

export const ORDER_COLUMNS = {
  name: ["Name"],
  id: ["Id", "ID", "Order ID"],
  email: ["Email"],
  financialStatus: ["Financial Status"],
  paidAt: ["Paid at"],
  fulfillmentStatus: ["Fulfillment Status"],
  fulfilledAt: ["Fulfilled at"],
  currency: ["Currency"],
  subtotal: ["Subtotal"],
  shipping: ["Shipping"],
  taxes: ["Taxes"],
  total: ["Total"],
  discountCode: ["Discount Code"],
  discountAmount: ["Discount Amount"],
  shippingMethod: ["Shipping Method"],
  createdAt: ["Created at"],
  lineQty: ["Lineitem quantity"],
  lineName: ["Lineitem name"],
  linePrice: ["Lineitem price"],
  lineSku: ["Lineitem sku"],
  lineFulfillment: ["Lineitem fulfillment status"],
  lineDiscount: ["Lineitem discount"],
  notes: ["Notes"],
  noteAttributes: ["Note Attributes"],
  cancelledAt: ["Cancelled at"],
  paymentMethod: ["Payment Method"],
  paymentReference: ["Payment Reference"],
  refundedAmount: ["Refunded Amount"],
  phone: ["Phone"],
  tags: ["Tags"],
  source: ["Source"],
  trackingNumber: ["Tracking Number", "Fulfillment Tracking Number", "Tracking"],
  trackingCompany: ["Tracking Company", "Fulfillment Tracking Company"],
  trackingUrl: ["Tracking URL", "Fulfillment Tracking URL"],
} as const;

export const REQUIRED_ORDER_COLUMNS = [
  "Name",
  "Email",
  "Created at",
  "Total",
  "Lineitem quantity",
  "Lineitem name",
  "Lineitem price",
];

function addressColumns(prefix: "Billing" | "Shipping") {
  return {
    name: [`${prefix} Name`],
    street: [`${prefix} Street`],
    address1: [`${prefix} Address1`],
    address2: [`${prefix} Address2`],
    company: [`${prefix} Company`],
    city: [`${prefix} City`],
    zip: [`${prefix} Zip`],
    country: [`${prefix} Country`],
    phone: [`${prefix} Phone`],
  };
}

// --- Gruppieren ---------------------------------------------------------------------------------

export interface OrderGroup {
  name: string;
  firstLine: number;
  rows: { line: number; data: RawRow }[];
}

/** Zeilen nach Bestellnummer (Spalte Name) gruppieren, Reihenfolge der Datei bleibt. */
export function groupOrderRows(rows: { line: number; data: RawRow }[]): {
  groups: OrderGroup[];
  orphans: number[];
} {
  const map = new Map<string, OrderGroup>();
  const orphans: number[] = [];
  for (const r of rows) {
    const name = pick(r.data, ORDER_COLUMNS.name);
    if (!name) {
      orphans.push(r.line);
      continue;
    }
    const g = map.get(name);
    if (g) g.rows.push(r);
    else map.set(name, { name, firstLine: r.line, rows: [r] });
  }
  return { groups: [...map.values()], orphans };
}

// --- Lesen ----------------------------------------------------------------------------------

export interface StoredAddressJson {
  first_name: string;
  last_name: string;
  company: string | null;
  street: string;
  house_number: string | null;
  address_addition: string | null;
  postal_code: string;
  city: string;
  country_code: string;
  phone: string | null;
}

export interface ParsedLine {
  line: number;
  quantity: number;
  name: string;
  sku: string | null;
  /** Shopify-Positionspreis je Stück, brutto, bei PROVIBE inklusive Pfand */
  priceCents: number;
  /** Rabatt der ganzen Position */
  discountCents: number;
  fulfilled: boolean;
}

export interface ParsedOrder {
  name: string;
  shopifyOrderId: string | null;
  email: string;
  phone: string | null;
  createdAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  financialStatus: string;
  fulfillmentStatus: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  taxesCents: number;
  totalCents: number;
  refundedCents: number;
  discountCode: string | null;
  discountAmountCents: number;
  shippingMethod: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
  noteAttributes: string | null;
  tags: string[];
  source: string | null;
  taxes: { name: string; rateBp: number | null; cents: number }[];
  billing: StoredAddressJson | null;
  shipping: StoredAddressJson | null;
  tracking: { number: string; company: string | null; url: string | null } | null;
  lines: ParsedLine[];
  warnings: string[];
}

/** Erster nicht leerer Wert über alle Zeilen der Bestellung. */
function first(group: OrderGroup, aliases: readonly string[]): string {
  for (const r of group.rows) {
    const v = pick(r.data, aliases);
    if (v) return v;
  }
  return "";
}

function readAddress(
  group: OrderGroup,
  prefix: "Billing" | "Shipping",
  warnings: string[],
): StoredAddressJson | null {
  const cols = addressColumns(prefix);
  const address1 = first(group, cols.address1) || first(group, cols.street);
  const zip = first(group, cols.zip);
  const city = first(group, cols.city);
  const fullName = first(group, cols.name);
  if (!address1 && !zip && !city && !fullName) return null;
  const { firstName, lastName } = splitFullName(fullName);
  const { street, houseNumber } = splitStreet(address1);
  const cc = countryCode(first(group, cols.country));
  if (!cc)
    warnings.push(`${prefix === "Billing" ? "Rechnungs" : "Liefer"}adresse ohne lesbares Land`);
  const address2 = first(group, cols.address2);
  return {
    first_name: firstName,
    last_name: lastName,
    company: nullable(first(group, cols.company)),
    street,
    house_number: houseNumber,
    // "Shipping Street" enthält Address1 und Address2 zusammen, deshalb Address2 nur getrennt übernehmen
    address_addition: address2 && !street.includes(address2) ? address2 : null,
    postal_code: zip,
    city,
    country_code: cc ?? "DE",
    phone: nullable(first(group, cols.phone)),
  };
}

export function parseOrderGroup(group: OrderGroup): MapResult<ParsedOrder> {
  const warnings: string[] = [];
  try {
    const email = normalizeEmail(first(group, ORDER_COLUMNS.email));
    if (!email) return { ok: false, reason: "keine E-Mail-Adresse an der Bestellung" };
    const createdAt = parseShopifyDate(first(group, ORDER_COLUMNS.createdAt));
    if (!createdAt) return { ok: false, reason: "Created at fehlt" };
    const totalCents = parseMoneyCents(first(group, ORDER_COLUMNS.total));
    if (totalCents === null) return { ok: false, reason: "Total fehlt" };
    const currency = (first(group, ORDER_COLUMNS.currency) || "EUR").toUpperCase();
    if (currency !== "EUR")
      return { ok: false, reason: `Währung ${currency} wird nicht unterstützt` };

    const lines: ParsedLine[] = [];
    for (const r of group.rows) {
      const name = pick(r.data, ORDER_COLUMNS.lineName);
      const qtyRaw = pick(r.data, ORDER_COLUMNS.lineQty);
      if (!name && !qtyRaw) continue;
      const quantity = parseIntOrNull(qtyRaw);
      if (!quantity || quantity <= 0)
        throw new Error(`Zeile ${r.line}: Lineitem quantity ungültig`);
      const priceCents = parseMoneyCents(pick(r.data, ORDER_COLUMNS.linePrice));
      if (priceCents === null || priceCents < 0)
        throw new Error(`Zeile ${r.line}: Lineitem price fehlt`);
      lines.push({
        line: r.line,
        quantity,
        name: name || "Position ohne Namen",
        sku: nullable(pick(r.data, ORDER_COLUMNS.lineSku)),
        priceCents,
        discountCents: Math.abs(parseMoneyOrZero(pick(r.data, ORDER_COLUMNS.lineDiscount))),
        fulfilled: pick(r.data, ORDER_COLUMNS.lineFulfillment).toLowerCase() === "fulfilled",
      });
    }
    if (lines.length === 0) return { ok: false, reason: "Bestellung ohne Positionen" };

    const taxes: ParsedOrder["taxes"] = [];
    for (let n = 1; n <= 5; n++) {
      const name = first(group, [`Tax ${n} Name`]);
      const value = parseMoneyCents(first(group, [`Tax ${n} Value`]));
      if (name && value !== null)
        taxes.push({ name, rateBp: rateBpFromTaxName(name), cents: value });
    }

    const trackingNumber = first(group, ORDER_COLUMNS.trackingNumber);
    return {
      ok: true,
      value: {
        name: group.name,
        shopifyOrderId: parseShopifyId(first(group, ORDER_COLUMNS.id)),
        email,
        phone: nullable(first(group, ORDER_COLUMNS.phone)),
        createdAt,
        paidAt: parseShopifyDate(first(group, ORDER_COLUMNS.paidAt)),
        fulfilledAt: parseShopifyDate(first(group, ORDER_COLUMNS.fulfilledAt)),
        cancelledAt: parseShopifyDate(first(group, ORDER_COLUMNS.cancelledAt)),
        financialStatus: first(group, ORDER_COLUMNS.financialStatus).toLowerCase(),
        fulfillmentStatus: first(group, ORDER_COLUMNS.fulfillmentStatus).toLowerCase(),
        currency,
        subtotalCents: parseMoneyOrZero(first(group, ORDER_COLUMNS.subtotal)),
        shippingCents: parseMoneyOrZero(first(group, ORDER_COLUMNS.shipping)),
        taxesCents: parseMoneyOrZero(first(group, ORDER_COLUMNS.taxes)),
        totalCents,
        refundedCents: Math.abs(parseMoneyOrZero(first(group, ORDER_COLUMNS.refundedAmount))),
        discountCode: nullable(first(group, ORDER_COLUMNS.discountCode)),
        discountAmountCents: Math.abs(parseMoneyOrZero(first(group, ORDER_COLUMNS.discountAmount))),
        shippingMethod: nullable(first(group, ORDER_COLUMNS.shippingMethod)),
        paymentMethod: nullable(first(group, ORDER_COLUMNS.paymentMethod)),
        paymentReference: nullable(first(group, ORDER_COLUMNS.paymentReference)),
        notes: nullable(first(group, ORDER_COLUMNS.notes)),
        noteAttributes: nullable(first(group, ORDER_COLUMNS.noteAttributes)),
        tags: parseTags(first(group, ORDER_COLUMNS.tags)),
        source: nullable(first(group, ORDER_COLUMNS.source)),
        taxes,
        billing: readAddress(group, "Billing", warnings),
        shipping: readAddress(group, "Shipping", warnings),
        tracking: trackingNumber
          ? {
              number: trackingNumber,
              company: nullable(first(group, ORDER_COLUMNS.trackingCompany)),
              url: nullable(first(group, ORDER_COLUMNS.trackingUrl)),
            }
          : null,
        lines,
        warnings,
      },
    };
  } catch (error) {
    return { ok: false, reason: errorMessage(error) };
  }
}

// --- Status ---------------------------------------------------------------------------------

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "partially_refunded";
export type PaymentStatus =
  "unpaid" | "authorized" | "paid" | "partially_refunded" | "refunded" | "failed";
export type FulfillmentStatus = "unfulfilled" | "partial" | "fulfilled";

/** Erfüllte Bestellungen, deren Versand länger als diese Frist zurückliegt, gelten als zugestellt. */
export const DELIVERED_AFTER_DAYS = 7;

/**
 * Shopify-Status auf unser Statusmodell:
 *   Financial: paid → paid, partially_refunded/refunded → gleich, authorized → authorized,
 *              pending/partially_paid/unpaid/voided → unpaid, expired → failed
 *   Fulfillment: fulfilled → fulfilled, partial → partial, sonst unfulfilled
 *   Bestellstatus: storniert (Cancelled at) → cancelled; erstattet → refunded/partially_refunded;
 *              fulfilled → delivered (Versand älter als 7 Tage) oder shipped; partial → processing;
 *              bezahlt → paid; sonst pending
 */
export function mapStatuses(input: {
  financialStatus: string;
  fulfillmentStatus: string;
  cancelledAt: string | null;
  fulfilledAt: string | null;
  now: Date;
}): {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  warning?: string;
} {
  const fin = input.financialStatus.trim().toLowerCase();
  const ful = input.fulfillmentStatus.trim().toLowerCase();
  let warning: string | undefined;

  let paymentStatus: PaymentStatus;
  switch (fin) {
    case "paid":
      paymentStatus = "paid";
      break;
    case "partially_refunded":
      paymentStatus = "partially_refunded";
      break;
    case "refunded":
      paymentStatus = "refunded";
      break;
    case "authorized":
      paymentStatus = "authorized";
      break;
    case "expired":
      paymentStatus = "failed";
      break;
    case "pending":
    case "partially_paid":
    case "unpaid":
    case "voided":
      paymentStatus = "unpaid";
      break;
    default:
      paymentStatus = "unpaid";
      warning = `Financial Status "${input.financialStatus}" unbekannt, als unbezahlt übernommen`;
  }

  const fulfillmentStatus: FulfillmentStatus =
    ful === "fulfilled" ? "fulfilled" : ful === "partial" ? "partial" : "unfulfilled";

  let status: OrderStatus;
  if (input.cancelledAt) status = "cancelled";
  else if (paymentStatus === "refunded") status = "refunded";
  else if (paymentStatus === "partially_refunded") status = "partially_refunded";
  else if (fulfillmentStatus === "fulfilled") {
    const ageDays = input.fulfilledAt
      ? (input.now.getTime() - new Date(input.fulfilledAt).getTime()) / 86_400_000
      : Infinity;
    status = ageDays > DELIVERED_AFTER_DAYS ? "delivered" : "shipped";
  } else if (fulfillmentStatus === "partial") status = "processing";
  else if (paymentStatus === "paid") status = "paid";
  else status = "pending";

  return { status, paymentStatus, fulfillmentStatus, warning };
}

/** Zahlungsart in unsere Kurzform (payment_method_type). */
export function mapPaymentMethod(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("paypal")) return "paypal";
  if (s.includes("klarna")) return "klarna";
  if (s.includes("sofort")) return "sofort";
  if (s.includes("sepa") || s.includes("lastschrift")) return "sepa_debit";
  if (s.includes("giropay")) return "giropay";
  if (
    s.includes("apple") ||
    s.includes("google") ||
    s.includes("shopify payments") ||
    s.includes("card") ||
    s.includes("kredit")
  )
    return "card";
  if (s.includes("manual") || s.includes("vorkasse") || s.includes("bank")) return "bank_transfer";
  return (
    s
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || null
  );
}

// --- Katalog und Varianten-Zuordnung ------------------------------------------------------------

export interface CatalogVariant {
  id: string;
  productId: string;
  handle: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  legacySku: string | null;
  unitCount: number;
  weightGrams: number | null;
  taxClass: string;
  netContentPerUnit: number | null;
  basePriceMeasure: UnitMeasure;
  /** Pfand je Einheit; bei Bundles die Summe des Komponenten-Pfands (wie im Checkout) */
  depositCentsPerUnit: number;
  shopifyVariantId: string | null;
  components: { variant_id: string; sku: string | null; title: string; quantity: number }[] | null;
  /** Namen, unter denen Shopify die Variante in "Lineitem name" führt */
  names: string[];
}

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[‐-―]/g, "-").replace(/\s+/g, " ").trim();
}

export interface VariantIndex {
  bySku: Map<string, CatalogVariant>;
  byName: Map<string, CatalogVariant>;
}

export function buildVariantIndex(variants: CatalogVariant[]): VariantIndex {
  const bySku = new Map<string, CatalogVariant>();
  const byName = new Map<string, CatalogVariant>();
  for (const v of variants) {
    for (const s of [v.sku, v.legacySku]) if (s) bySku.set(s.toUpperCase(), v);
    for (const n of v.names) {
      const key = normalizeName(n);
      if (!byName.has(key)) byName.set(key, v);
    }
  }
  return { bySku, byName };
}

/** Variante über SKU (neu oder Legacy), sonst über den Positionsnamen. */
export function matchVariant(
  line: Pick<ParsedLine, "sku" | "name">,
  index: VariantIndex,
): { variant: CatalogVariant; via: "sku" | "name" } | null {
  if (line.sku) {
    const v = index.bySku.get(line.sku.toUpperCase());
    if (v) return { variant: v, via: "sku" };
  }
  const v = index.byName.get(normalizeName(line.name));
  return v ? { variant: v, via: "name" } : null;
}

/** Pfand und Warenpreis je Stück aus dem Shopify-Preis (Pfand war bei PROVIBE im Preis enthalten). */
export function splitDeposit(
  priceCents: number,
  variant: Pick<CatalogVariant, "depositCentsPerUnit" | "unitCount"> | null,
): { unitPriceCents: number; unitDepositCents: number } {
  if (!variant) return { unitPriceCents: priceCents, unitDepositCents: 0 };
  const unitDepositCents = depositPerItemCents({
    priceCents,
    depositCentsPerUnit: variant.depositCentsPerUnit,
    unitCount: variant.unitCount,
  });
  return { unitPriceCents: priceCents - unitDepositCents, unitDepositCents };
}

// --- Bestellung bauen -------------------------------------------------------------------------

export interface PlannedItem {
  variant_id: string | null;
  product_id: string | null;
  product_handle: string | null;
  product_title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  unit_count: number;
  unit_price_cents: number;
  unit_deposit_cents: number;
  discount_cents: number;
  tax_class: string;
  tax_rate_bp: number;
  line_total_cents: number;
  weight_grams: number | null;
  base_price_text: string | null;
  components: CatalogVariant["components"];
  fulfilled_quantity: number;
  position: number;
}

export interface PlannedOrder {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  depositCents: number;
  taxCents: number;
  totalCents: number;
  taxLines: { rate_bp: number; taxable_cents: number; tax_cents: number }[];
  shippingAddress: StoredAddressJson | Record<string, never>;
  billingAddress: StoredAddressJson | null;
  paymentMethodType: string | null;
  items: PlannedItem[];
  freeLines: number;
  warnings: string[];
}

const OWN_NUMBER = /^PV-\d+$/i;

/**
 * Bestellnummer: Die Shopify-Nummer bleibt erhalten (z.B. "#1042"), so wie Konto, Widerrufsformular
 * und parseOrderNumber() es erwarten. Unser Nummernkreis PV-10001 … wird nicht berührt, weil
 * order_number explizit gesetzt wird. Kollidiert ein Shopify-Name mit unserem Schema, bekommt er
 * das Präfix "SHOPIFY-".
 */
export function importedOrderNumber(shopifyName: string): string {
  const name = shopifyName.trim();
  return OWN_NUMBER.test(name) ? `SHOPIFY-${name}` : name;
}

export function planOrder(order: ParsedOrder, index: VariantIndex, now: Date): PlannedOrder {
  const warnings = [...order.warnings];
  const st = mapStatuses({
    financialStatus: order.financialStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    cancelledAt: order.cancelledAt,
    fulfilledAt: order.fulfilledAt,
    now,
  });
  if (st.warning) warnings.push(st.warning);

  const singleRate = order.taxes.length === 1 ? order.taxes[0].rateBp : null;
  const distinctRates = new Set(order.taxes.map((t) => t.rateBp));
  const lineRate = singleRate ?? (distinctRates.size === 1 ? [...distinctRates][0] : null) ?? 1900;
  if (order.taxes.length > 1 && distinctRates.size > 1) {
    warnings.push(
      "mehrere Steuersätze, Positionen mit 19 % übernommen, Steuerzeilen aus dem Export",
    );
  }

  let freeLines = 0;
  const items: PlannedItem[] = order.lines.map((l, i) => {
    const match = matchVariant(l, index);
    const v = match?.variant ?? null;
    if (!v) {
      freeLines++;
      warnings.push(
        `Position "${l.name}"${l.sku ? ` (SKU ${l.sku})` : ""} ohne passende Variante, als freie Position übernommen (ohne Pfand)`,
      );
    }
    const { unitPriceCents, unitDepositCents } = splitDeposit(l.priceCents, v);
    let basePriceText: string | null = null;
    if (v) {
      try {
        basePriceText = formatBasePrice(
          calculateBasePrice({
            priceCents: l.priceCents,
            depositCentsPerUnit: unitDepositCents === 0 ? 0 : v.depositCentsPerUnit,
            unitCount: v.unitCount,
            netContentPerUnit: v.netContentPerUnit,
            measure: v.basePriceMeasure,
          }),
        );
      } catch {
        basePriceText = null;
      }
    }
    return {
      variant_id: v?.id ?? null,
      product_id: v?.productId ?? null,
      product_handle: v?.handle ?? null,
      product_title: v?.productTitle ?? l.name,
      variant_title: v ? v.variantTitle : null,
      sku: v?.sku ?? l.sku,
      quantity: l.quantity,
      unit_count: v?.unitCount ?? 1,
      unit_price_cents: unitPriceCents,
      unit_deposit_cents: unitDepositCents,
      discount_cents: l.discountCents,
      tax_class: v?.taxClass ?? "standard",
      tax_rate_bp: lineRate,
      line_total_cents: 0,
      weight_grams: v?.weightGrams ?? null,
      base_price_text: basePriceText,
      components: v?.components ?? null,
      fulfilled_quantity: l.fulfilled || st.fulfillmentStatus === "fulfilled" ? l.quantity : 0,
      position: i,
    };
  });

  // Rabatt: Positionsrabatte aus dem Export; fehlen sie, den Bestellrabatt anteilig verteilen,
  // aber nur, wenn die Summen aufgehen (sonst war es vermutlich ein Versandrabatt).
  const itemsGross = order.lines.reduce((s, l) => s + l.quantity * l.priceCents, 0);
  const lineDiscounts = items.reduce((s, it) => s + it.discount_cents, 0);
  if (lineDiscounts === 0 && order.discountAmountCents > 0) {
    if (itemsGross - order.discountAmountCents + order.shippingCents === order.totalCents) {
      const shares = allocateProportionally(
        order.discountAmountCents,
        items.map((it) => it.quantity * it.unit_price_cents),
      );
      items.forEach((it, i) => (it.discount_cents = shares[i]));
    } else {
      warnings.push("Rabatt ließ sich keiner Position zuordnen (vermutlich Versandrabatt)");
    }
  }
  for (const it of items) {
    it.line_total_cents =
      it.quantity * (it.unit_price_cents + it.unit_deposit_cents) - it.discount_cents;
  }

  const subtotalCents = items.reduce((s, it) => s + it.quantity * it.unit_price_cents, 0);
  const depositCents = items.reduce((s, it) => s + it.quantity * it.unit_deposit_cents, 0);
  const discountCents = order.discountAmountCents;
  const expected = subtotalCents + depositCents - discountCents + order.shippingCents;
  if (Math.abs(expected - order.totalCents) > 1) {
    warnings.push(
      `Summen weichen ab: Positionen ${subtotalCents + depositCents} − Rabatt ${discountCents} + Versand ${order.shippingCents} = ${expected} Cent, Shopify-Total ${order.totalCents} Cent (Shopify-Total übernommen)`,
    );
  }

  const taxLines =
    order.taxes.length > 0
      ? order.taxes.map((t) => ({
          rate_bp: t.rateBp ?? lineRate,
          taxable_cents:
            order.taxes.length === 1 || !t.rateBp
              ? order.totalCents
              : Math.round((t.cents * (10_000 + t.rateBp)) / t.rateBp),
          tax_cents: t.cents,
        }))
      : order.taxesCents > 0
        ? [{ rate_bp: lineRate, taxable_cents: order.totalCents, tax_cents: order.taxesCents }]
        : [];

  return {
    orderNumber: importedOrderNumber(order.name),
    status: st.status,
    paymentStatus: st.paymentStatus,
    fulfillmentStatus: st.fulfillmentStatus,
    subtotalCents,
    discountCents,
    shippingCents: order.shippingCents,
    depositCents,
    taxCents: order.taxesCents,
    totalCents: order.totalCents,
    taxLines,
    shippingAddress: order.shipping ?? order.billing ?? {},
    billingAddress: order.billing,
    paymentMethodType: mapPaymentMethod(order.paymentMethod),
    items,
    freeLines,
    warnings,
  };
}
