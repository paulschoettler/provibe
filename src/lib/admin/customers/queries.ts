import "server-only";
import { z } from "zod";
import { crmDb, dbError } from "./crm-db";
import { parseInput } from "./guard";
import {
  accountStatus,
  buildTimeline,
  customerKpis,
  displayName,
  initials,
  optInProof,
  type AccountStatus,
  type CustomerKpis,
  type NewsletterContactRow,
  type OptInProof,
  type TimelineEntry,
} from "./profile";
import {
  NEWSLETTER_SEGMENT_STATUSES,
  parseStoredRules,
  type InternalCondition,
  type NewsletterSegmentStatus,
  type SegmentCondition,
  type SegmentRules,
} from "@/lib/admin/segments/rules";
import {
  countSegmentMembers,
  segmentMemberIds,
  type MemberOrder,
} from "@/lib/admin/segments/segments";

/**
 * Lesende Abfragen der Kundenliste und des Kundenprofils. Alle Filter der Liste laufen über die
 * Segment-Übersetzung (eine sichere SQL-Quelle). Rechteprüfung (viewCustomers) macht die Seite
 * bzw. Server Action vor dem Aufruf.
 */

export const customerListFilterSchema = z.object({
  q: z.string().trim().max(100).optional(),
  segmentId: z.string().uuid().optional(),
  newsletter: z.enum(NEWSLETTER_SEGMENT_STATUSES).optional(),
  tag: z.string().trim().min(1).max(50).optional(),
  customerType: z.enum(["b2c", "b2b"]).optional(),
  /** Sperrstatus: true nur gesperrte, false nur nicht gesperrte */
  blocked: z.boolean().optional(),
  order: z
    .enum(["last_order_desc", "created_desc", "total_spent_desc", "orders_desc", "name_asc"])
    .default("last_order_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type CustomerListFilter = z.input<typeof customerListFilterSchema>;

export interface CustomerListItem {
  id: string;
  name: string;
  initials: string;
  email: string;
  customerType: "b2c" | "b2b";
  companyName: string | null;
  tags: string[];
  ordersCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
  createdAt: string;
  acquisitionSource: string | null;
  newsletterStatus: NewsletterSegmentStatus;
  accountStatus: AccountStatus;
}

export async function listCustomers(
  filter: CustomerListFilter = {},
): Promise<{ items: CustomerListItem[]; total: number; page: number; pageSize: number }> {
  const f = parseInput(customerListFilterSchema, filter);
  const db = crmDb();

  let rules: SegmentRules = { match: "all", conditions: [] };
  if (f.segmentId) {
    const { data } = await db
      .from("saved_segments")
      .select("definition")
      .eq("id", f.segmentId)
      .maybeSingle();
    const parsed = data ? parseStoredRules(data.definition) : null;
    if (!parsed) throw new Error("Segment nicht gefunden");
    rules = parsed;
  }
  const extra: (SegmentCondition | InternalCondition)[] = [];
  if (f.q) extra.push({ field: "search", op: "matches", value: f.q });
  if (f.newsletter) extra.push({ field: "newsletter_status", op: "is", value: f.newsletter });
  if (f.tag) extra.push({ field: "tag", op: "has", value: f.tag });
  if (f.customerType) extra.push({ field: "customer_type", op: "is", value: f.customerType });
  if (f.blocked !== undefined) extra.push({ field: "blocked", op: "is", value: f.blocked });

  const [ids, total] = await Promise.all([
    segmentMemberIds(rules, {
      extra,
      limit: f.pageSize,
      offset: (f.page - 1) * f.pageSize,
      order: f.order as MemberOrder,
    }),
    countSegmentMembers(rules, extra),
  ]);
  if (ids.length === 0) return { items: [], total, page: f.page, pageSize: f.pageSize };

  const { data: rows, error } = await db
    .from("customers")
    .select(
      "id, email, first_name, last_name, customer_type, company_name, tags, orders_count, total_spent_cents, last_order_at, created_at, acquisition_source, anonymized_at, blocked_at, auth_user_id",
    )
    .in("id", ids);
  if (error) throw dbError("Kunden laden", error);
  const emails = (rows ?? []).map((r) => String(r.email));
  const { data: contacts } = await db
    .from("newsletter_contacts")
    .select("customer_id, email, status")
    .or(
      `customer_id.in.(${ids.join(",")}),email.in.(${emails.map((e) => `"${e.replace(/"/g, "")}"`).join(",")})`,
    );
  const statusByCustomer = new Map<string, NewsletterSegmentStatus>();
  const statusByEmail = new Map<string, NewsletterSegmentStatus>();
  for (const c of contacts ?? []) {
    if (c.customer_id) statusByCustomer.set(c.customer_id, c.status);
    statusByEmail.set(String(c.email).toLowerCase(), c.status);
  }
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  const items = ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => {
      const name = displayName(r);
      return {
        id: r.id,
        name,
        initials: initials(name),
        email: r.email,
        customerType: r.customer_type,
        companyName: r.company_name,
        tags: r.tags,
        ordersCount: r.orders_count,
        totalSpentCents: Number(r.total_spent_cents),
        lastOrderAt: r.last_order_at,
        createdAt: r.created_at,
        acquisitionSource: r.acquisition_source,
        newsletterStatus:
          statusByCustomer.get(r.id) ?? statusByEmail.get(String(r.email).toLowerCase()) ?? "none",
        accountStatus: accountStatus(r),
      };
    });
  return { items, total, page: f.page, pageSize: f.pageSize };
}

/** Alle vergebenen Tags (für Filter und Vorschläge), alphabetisch. */
export async function listCustomerTags(): Promise<string[]> {
  const { data, error } = await crmDb()
    .from("customers")
    .select("tags")
    .not("tags", "eq", "{}")
    .is("anonymized_at", null)
    .limit(5000);
  if (error) throw dbError("Tags laden", error);
  const set = new Set<string>();
  for (const r of data ?? []) for (const t of r.tags) set.add(t);
  return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
}

export interface CustomerOrderRow {
  id: string;
  orderNumber: string;
  placedAt: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalCents: number;
  itemCount: number;
  isTest: boolean;
}

export interface CustomerAddressRow {
  id: string;
  label: string | null;
  firstName: string;
  lastName: string;
  company: string | null;
  street: string;
  houseNumber: string | null;
  addressAddition: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
  phone: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export interface CustomerNoteRow {
  id: string;
  body: string;
  authorUserId: string | null;
  authorName: string | null;
  createdAt: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  initials: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  locale: string;
  customerType: "b2c" | "b2b";
  companyName: string | null;
  vatId: string | null;
  b2bStatus: string;
  tags: string[];
  createdAt: string;
  acquisition: { source: string | null; details: unknown };
  account: {
    status: AccountStatus;
    authUserId: string | null;
    activationEmailSentAt: string | null;
    blockedAt: string | null;
    blockedReason: string | null;
    anonymizedAt: string | null;
    shopifyCustomerId: number | null;
  };
  kpis: CustomerKpis;
  addresses: CustomerAddressRow[];
  orders: CustomerOrderRow[];
  newsletter: OptInProof;
  newsletterContactId: string | null;
  notes: CustomerNoteRow[];
  timeline: TimelineEntry[];
}

async function staffNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => Boolean(x))));
  if (unique.length === 0) return new Map();
  const { data } = await crmDb()
    .from("staff_users")
    .select("user_id, display_name, email")
    .in("user_id", unique);
  return new Map((data ?? []).map((s) => [s.user_id, s.display_name ?? s.email]));
}

export async function getCustomerProfile(id: string): Promise<CustomerProfile | null> {
  const customerId = parseInput(z.string().uuid(), id);
  const db = crmDb();
  const { data: c, error } = await db
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .maybeSingle();
  if (error) throw dbError("Kunde laden", error);
  if (!c) return null;

  const [addresses, orders, contacts, notes, events, emails] = await Promise.all([
    db.from("customer_addresses").select("*").eq("customer_id", c.id).order("created_at"),
    db
      .from("orders")
      .select(
        "id, order_number, placed_at, status, payment_status, fulfillment_status, total_cents, is_test, order_items(quantity)",
      )
      .eq("customer_id", c.id)
      .order("placed_at", { ascending: false })
      .limit(200),
    db
      .from("newsletter_contacts")
      .select(
        "id, email, status, source, opt_in_sent_at, confirmed_at, confirm_ip, confirm_user_agent, consent_text, consent_version, imported_consent_at, unsubscribed_at, unsubscribe_reason, created_at, customer_id",
      )
      .or(`customer_id.eq.${c.id},email.eq."${String(c.email).replace(/"/g, "")}"`),
    db
      .from("customer_notes")
      .select("*")
      .eq("customer_id", c.id)
      .order("created_at", { ascending: false }),
    db
      .from("customer_events")
      .select("id, kind, data, created_at")
      .eq("customer_id", c.id)
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("email_messages")
      .select("id, subject, template, status, to_email, created_at, order_id")
      .or(`customer_id.eq.${c.id},to_email.eq."${String(c.email).replace(/"/g, "")}"`)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const orderRows = orders.data ?? [];
  const orderIds = orderRows.map((o) => o.id);
  const numberById = new Map(orderRows.map((o) => [o.id, o.order_number]));
  const orderEvents =
    orderIds.length > 0
      ? ((
          await db
            .from("order_events")
            .select("id, order_id, kind, message, created_at")
            .in("order_id", orderIds)
            .order("created_at", { ascending: false })
            .limit(300)
        ).data ?? [])
      : [];

  const contactRows = (contacts.data ?? []) as (NewsletterContactRow & {
    customer_id: string | null;
  })[];
  const contact = contactRows.find((x) => x.customer_id === c.id) ?? contactRows[0] ?? null;
  const names = await staffNames((notes.data ?? []).map((n) => n.author_user_id));
  const noteRows: CustomerNoteRow[] = (notes.data ?? []).map((n) => ({
    id: n.id,
    body: n.body,
    authorUserId: n.author_user_id,
    authorName: n.author_user_id ? (names.get(n.author_user_id) ?? null) : null,
    createdAt: n.created_at,
  }));

  const kpiOrders = orderRows.map((o) => ({
    orderNumber: o.order_number,
    placedAt: o.placed_at,
    status: o.status,
    paymentStatus: o.payment_status,
    totalCents: o.total_cents,
    isTest: o.is_test,
  }));
  const name = displayName(c);

  return {
    id: c.id,
    name,
    initials: initials(name),
    email: c.email,
    firstName: c.first_name,
    lastName: c.last_name,
    phone: c.phone,
    locale: c.locale,
    customerType: c.customer_type,
    companyName: c.company_name,
    vatId: c.vat_id,
    b2bStatus: c.b2b_status,
    tags: c.tags,
    createdAt: c.created_at,
    acquisition: { source: c.acquisition_source, details: c.acquisition_details },
    account: {
      status: accountStatus(c),
      authUserId: c.auth_user_id,
      activationEmailSentAt: c.activation_email_sent_at,
      blockedAt: c.blocked_at,
      blockedReason: c.blocked_reason,
      anonymizedAt: c.anonymized_at,
      shopifyCustomerId: c.shopify_customer_id,
    },
    kpis: customerKpis(c, kpiOrders),
    addresses: (addresses.data ?? []).map((a) => ({
      id: a.id,
      label: a.label,
      firstName: a.first_name,
      lastName: a.last_name,
      company: a.company,
      street: a.street,
      houseNumber: a.house_number,
      addressAddition: a.address_addition,
      postalCode: a.postal_code,
      city: a.city,
      countryCode: a.country_code,
      phone: a.phone,
      isDefaultShipping: a.is_default_shipping,
      isDefaultBilling: a.is_default_billing,
    })),
    orders: orderRows.map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      placedAt: o.placed_at,
      status: o.status,
      paymentStatus: o.payment_status,
      fulfillmentStatus: o.fulfillment_status,
      totalCents: o.total_cents,
      itemCount: (o.order_items ?? []).reduce((s, i) => s + i.quantity, 0),
      isTest: o.is_test,
    })),
    newsletter: optInProof(contact),
    newsletterContactId: contact?.id ?? null,
    notes: noteRows,
    timeline: buildTimeline({
      customerEvents: events.data ?? [],
      orders: orderRows.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        placed_at: o.placed_at,
        total_cents: o.total_cents,
      })),
      orderEvents: orderEvents.map((e) => ({
        ...e,
        order_number: numberById.get(e.order_id) ?? null,
      })),
      newsletter: contact,
      notes: noteRows.map((n) => ({
        id: n.id,
        body: n.body,
        author: n.authorName,
        created_at: n.createdAt,
      })),
      emails: emails.data ?? [],
    }),
  };
}

export interface CustomerSubscriptionRow {
  id: string;
  status: string;
  quantity: number;
  intervalUnit: string;
  intervalCount: number;
  discountBp: number;
  nextOrderAt: string | null;
  pausedUntil: string | null;
  cancelledAt: string | null;
  createdAt: string;
  variantTitle: string | null;
  productTitle: string | null;
}

/** Abos des Kunden (nur lesend im Profil; Verwaltung im Abo-Modul). */
export async function getCustomerSubscriptions(id: string): Promise<CustomerSubscriptionRow[]> {
  const customerId = parseInput(z.string().uuid(), id);
  const { data, error } = await crmDb()
    .from("subscriptions")
    .select(
      "id, status, quantity, interval_unit, interval_count, discount_bp, next_order_at, paused_until, cancelled_at, created_at, product_variants(title, products(handle, product_translations(title, locale)))",
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) {
    // Abo-Tabelle kann sich mit dem Abo-Paket noch ändern; das Profil zeigt dann keinen Hinweis
    console.error("[crm] Abos laden", error.message);
    return [];
  }
  return (data ?? []).map((s) => {
    const v = s.product_variants as unknown as {
      title: string | null;
      products: {
        handle: string;
        product_translations: { title: string; locale: string }[] | null;
      } | null;
    } | null;
    const t = v?.products?.product_translations?.find((x) => x.locale === "de");
    return {
      id: s.id,
      status: String(s.status),
      quantity: s.quantity,
      intervalUnit: String(s.interval_unit),
      intervalCount: s.interval_count,
      discountBp: s.discount_bp,
      nextOrderAt: s.next_order_at,
      pausedUntil: s.paused_until,
      cancelledAt: s.cancelled_at,
      createdAt: s.created_at,
      variantTitle: v?.title ?? null,
      productTitle: t?.title ?? v?.products?.handle ?? null,
    };
  });
}
