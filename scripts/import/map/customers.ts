/**
 * Shopify "Export customers" (CSV) auf unser Kundenmodell abbilden. Unterstützt das aktuelle
 * Format (Customer ID, Default Address …, Accepts Email Marketing) und das ältere Format
 * (Company, Address1, Accepts Marketing). Reine Funktionen, getestet in __tests__/customers.test.ts.
 */
import { splitStreet } from "@/lib/checkout/snapshot";
import type { RawRow } from "../lib/csv";
import {
  countryCode,
  nullable,
  parseIntOrNull,
  parseMoneyCents,
  parseShopifyDate,
  parseShopifyId,
  parseTags,
  parseYesNo,
  normalizeEmail,
  pick,
} from "../lib/values";

export const CUSTOMER_COLUMNS = {
  shopifyId: ["Customer ID", "ID", "Id"],
  firstName: ["First Name"],
  lastName: ["Last Name"],
  email: ["Email", "E-Mail"],
  acceptsEmailMarketing: ["Accepts Email Marketing", "Accepts Marketing"],
  company: ["Default Address Company", "Company"],
  address1: ["Default Address Address1", "Address1"],
  address2: ["Default Address Address2", "Address2"],
  city: ["Default Address City", "City"],
  provinceCode: ["Default Address Province Code", "Province Code"],
  countryCode: ["Default Address Country Code", "Country Code"],
  country: ["Default Address Country", "Country"],
  zip: ["Default Address Zip", "Zip"],
  addressPhone: ["Default Address Phone"],
  phone: ["Phone"],
  acceptsSms: ["Accepts SMS Marketing"],
  totalSpent: ["Total Spent"],
  totalOrders: ["Total Orders"],
  tags: ["Tags"],
  note: ["Note"],
  taxExempt: ["Tax Exempt"],
  createdAt: ["Created At", "Customer Created At"],
} as const;

export const REQUIRED_CUSTOMER_COLUMNS = ["Email"] as const;

/** Markiert importierte Kunden, damit Backoffice-Segmente sie finden. */
export const IMPORT_TAG = "shopify_import";
export const ACQUISITION_SOURCE = "import_shopify";

export interface MappedAddress {
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

export interface MappedCustomer {
  email: string;
  shopifyCustomerId: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  companyName: string | null;
  tags: string[];
  ordersCount: number;
  totalSpentCents: number;
  note: string | null;
  address: MappedAddress | null;
  /** Für acquisition_details.import_shopify (ohne Importzeitpunkt, den setzt das Skript) */
  details: {
    shopify_customer_id: string | null;
    accepts_email_marketing: boolean | null;
    accepts_sms_marketing: boolean | null;
    tax_exempt: boolean | null;
    total_spent_cents: number;
    orders_count: number;
    shopify_created_at: string | null;
    province_code: string | null;
  };
  warnings: string[];
}

export type MapResult<T> = { ok: true; value: T } | { ok: false; reason: string; skip?: boolean };

function optionalYesNo(value: string): boolean | null {
  return value === "" ? null : parseYesNo(value);
}

export function mapCustomerRow(row: RawRow): MapResult<MappedCustomer> {
  const warnings: string[] = [];
  try {
    const email = normalizeEmail(pick(row, CUSTOMER_COLUMNS.email));
    if (!email)
      return {
        ok: false,
        reason: "keine E-Mail-Adresse (Shopify-Kunde nur mit Telefon)",
        skip: true,
      };

    const firstName = nullable(pick(row, CUSTOMER_COLUMNS.firstName));
    const lastName = nullable(pick(row, CUSTOMER_COLUMNS.lastName));
    const company = nullable(pick(row, CUSTOMER_COLUMNS.company));
    const phone =
      nullable(pick(row, CUSTOMER_COLUMNS.phone)) ??
      nullable(pick(row, CUSTOMER_COLUMNS.addressPhone));
    const totalSpentCents = parseMoneyCents(pick(row, CUSTOMER_COLUMNS.totalSpent)) ?? 0;
    const ordersCount = parseIntOrNull(pick(row, CUSTOMER_COLUMNS.totalOrders)) ?? 0;
    const shopifyCustomerId = parseShopifyId(pick(row, CUSTOMER_COLUMNS.shopifyId));

    let address: MappedAddress | null = null;
    const address1 = pick(row, CUSTOMER_COLUMNS.address1);
    const zip = pick(row, CUSTOMER_COLUMNS.zip);
    const city = pick(row, CUSTOMER_COLUMNS.city);
    if (address1 || zip || city) {
      const cc =
        countryCode(pick(row, CUSTOMER_COLUMNS.countryCode)) ??
        countryCode(pick(row, CUSTOMER_COLUMNS.country));
      const missing = [
        !address1 && "Straße",
        !zip && "PLZ",
        !city && "Ort",
        !cc && "Land",
        !lastName && !company && "Name",
      ].filter(Boolean);
      if (missing.length > 0) {
        warnings.push(`Standardadresse unvollständig (${missing.join(", ")}), nicht übernommen`);
      } else {
        const { street, houseNumber } = splitStreet(address1);
        if (!houseNumber) warnings.push("Hausnummer nicht erkannt, steht im Feld Straße");
        address = {
          first_name: firstName ?? "",
          last_name: lastName ?? company ?? "",
          company,
          street,
          house_number: houseNumber,
          address_addition: nullable(pick(row, CUSTOMER_COLUMNS.address2)),
          postal_code: zip,
          city,
          country_code: cc!,
          phone: nullable(pick(row, CUSTOMER_COLUMNS.addressPhone)) ?? phone,
        };
      }
    }

    return {
      ok: true,
      value: {
        email,
        shopifyCustomerId,
        firstName,
        lastName,
        phone,
        companyName: company,
        tags: [...parseTags(pick(row, CUSTOMER_COLUMNS.tags)), IMPORT_TAG],
        ordersCount,
        totalSpentCents,
        note: nullable(pick(row, CUSTOMER_COLUMNS.note)),
        address,
        details: {
          shopify_customer_id: shopifyCustomerId,
          accepts_email_marketing: optionalYesNo(pick(row, CUSTOMER_COLUMNS.acceptsEmailMarketing)),
          accepts_sms_marketing: optionalYesNo(pick(row, CUSTOMER_COLUMNS.acceptsSms)),
          tax_exempt: optionalYesNo(pick(row, CUSTOMER_COLUMNS.taxExempt)),
          total_spent_cents: totalSpentCents,
          orders_count: ordersCount,
          shopify_created_at: parseShopifyDate(pick(row, CUSTOMER_COLUMNS.createdAt)),
          province_code: nullable(pick(row, CUSTOMER_COLUMNS.provinceCode)),
        },
        warnings,
      },
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Gleiche Adresse? Vergleich ohne Groß/Kleinschreibung und Leerraum. */
export function sameAddress(
  a: Pick<MappedAddress, "street" | "house_number" | "postal_code" | "city" | "country_code">,
  b: Pick<MappedAddress, "street" | "house_number" | "postal_code" | "city" | "country_code">,
): boolean {
  const n = (v: string | null) =>
    (v ?? "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/straße$/, "str.");
  return (
    n(a.street) === n(b.street) &&
    n(a.house_number) === n(b.house_number) &&
    n(a.postal_code) === n(b.postal_code) &&
    n(a.city) === n(b.city) &&
    n(a.country_code) === n(b.country_code)
  );
}

/** Tags zusammenführen, bestehende Reihenfolge bleibt, neue hinten an. */
export function mergeTags(existing: string[], incoming: string[]): string[] {
  const out = [...existing];
  const seen = new Set(existing.map((t) => t.toLowerCase()));
  for (const t of incoming) {
    if (!seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}
