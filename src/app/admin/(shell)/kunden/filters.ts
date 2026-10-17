import { firstParam, type SearchParamsInput } from "@/components/admin/ui/href";
import type { CustomerListFilter } from "@/lib/admin/customers/queries";
import { NEWSLETTER_SEGMENT_STATUSES } from "@/lib/admin/segments/rules";

/** Filter der Kundenliste aus der URL (Seite und CSV-Export nutzen dieselbe Übersetzung). */

const UUID = /^[0-9a-f-]{36}$/i;
const ORDERS = {
  letzte: "last_order_desc",
  neu: "created_desc",
  umsatz: "total_spent_desc",
  bestellungen: "orders_desc",
  name: "name_asc",
} as const;

export type CustomerSortKey = keyof typeof ORDERS;

export function customerFilterFromParams(sp: SearchParamsInput): {
  filter: CustomerListFilter;
  sortKey: CustomerSortKey;
  active: boolean;
} {
  const q = firstParam(sp.q)?.trim().slice(0, 100) || undefined;
  const segment = firstParam(sp.segment);
  const newsletter = firstParam(sp.newsletter);
  const tag = firstParam(sp.tag)?.trim().slice(0, 50) || undefined;
  const gesperrt = firstParam(sp.gesperrt);
  const sortRaw = firstParam(sp.sort) as CustomerSortKey | undefined;
  const sortKey: CustomerSortKey = sortRaw && sortRaw in ORDERS ? sortRaw : "letzte";
  const filter: CustomerListFilter = {
    q,
    segmentId: segment && UUID.test(segment) ? segment : undefined,
    newsletter: (NEWSLETTER_SEGMENT_STATUSES as readonly string[]).includes(newsletter ?? "")
      ? (newsletter as CustomerListFilter["newsletter"])
      : undefined,
    tag,
    blocked: gesperrt === "ja" ? true : gesperrt === "nein" ? false : undefined,
    order: ORDERS[sortKey],
  };
  const active = Boolean(
    filter.q || filter.segmentId || filter.newsletter || filter.tag || filter.blocked !== undefined,
  );
  return { filter, sortKey, active };
}
