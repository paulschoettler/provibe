import { z } from "zod";
import {
  evaluateDiscount,
  validateDiscount,
  type DiscountEvaluation,
  type DiscountKind,
  type DiscountRule,
  type PricedLine,
} from "@/lib/pricing";

/**
 * Reine Regeln für Rabattcodes im Backoffice (Paket Admin-Katalog).
 *
 * Die Prüfung im Checkout macht src/lib/pricing/discounts.ts (validateDiscount, evaluateDiscount).
 * Hier wird dieselbe Abbildung Datenbankzeile → DiscountRule verwendet wie in
 * src/lib/checkout/discount.ts (toRule), damit Backoffice-Vorschau und Kasse identisch rechnen.
 *
 * Automatische Rabatte (ohne Code) gibt das Schema nicht her: discount_codes.code ist NOT NULL
 * und der Checkout sucht nur nach eingegebenem Code. Siehe Bericht.
 */

export const DISCOUNT_KINDS = [
  { value: "percentage", label: "Prozentual" },
  { value: "fixed_amount", label: "Fester Betrag" },
  { value: "free_shipping", label: "Versandkostenfrei" },
] as const;

export const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

/** "  presale 10 " → "PRESALE10". Codes sind in der Datenbank citext, also ohnehin ohne Groß/klein. */
export function normalizeCode(raw: string): string {
  return raw.normalize("NFKC").replace(/\s+/g, "").toUpperCase();
}

/** "10", "10,5", "10.5 %" → Basispunkte (1000 = 10 %). null bei ungültiger Eingabe. */
export function parsePercentToBasisPoints(raw: string): number | null {
  const v = raw.replace(/\s|%/g, "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(v)) return null;
  const bp = Math.round(Number(v) * 100);
  return bp >= 1 && bp <= 10_000 ? bp : null;
}

/** "12", "12,5", "1.234,50 €", "12.50" → Cent. null bei ungültiger Eingabe. */
export function parseEuroToCents(raw: string): number | null {
  let v = raw.replace(/\s|€|EUR/gi, "");
  if (!v) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(v)) v = v.replace(/\./g, "").replace(",", ".");
  else v = v.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const [euros, cents = ""] = v.split(".");
  return Number(euros) * 100 + Number(cents.padEnd(2, "0"));
}

export const appliesToSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("order") }),
  z.object({
    scope: z.literal("products"),
    ids: z.array(z.guid()).min(1, "Bitte wähle mindestens ein Produkt.").max(200),
  }),
  z.object({
    scope: z.literal("collections"),
    ids: z.array(z.guid()).min(1, "Bitte wähle mindestens eine Kollektion.").max(50),
  }),
]);
export type AppliesTo = z.infer<typeof appliesToSchema>;

export function parseAppliesTo(raw: unknown): AppliesTo {
  const parsed = appliesToSchema.safeParse(raw);
  return parsed.success ? parsed.data : { scope: "order" };
}

const dateOrNull = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce.date({ error: "Bitte ein gültiges Datum." }).nullable(),
);

const limitOrNull = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.number().int("Nur ganze Zahlen.").min(1, "Mindestens 1.").max(1_000_000).nullable(),
);

export const discountInputSchema = z
  .object({
    id: z.guid().optional(),
    code: z
      .string()
      .transform(normalizeCode)
      .refine(
        (c) => CODE_RE.test(c),
        "3 bis 32 Zeichen: Buchstaben, Ziffern, Binde- und Unterstrich.",
      ),
    title: z
      .string()
      .trim()
      .max(120, "Bitte höchstens 120 Zeichen.")
      .nullish()
      .transform((v) => (v ? v : null)),
    kind: z.enum(["percentage", "fixed_amount", "free_shipping"], {
      error: "Bitte wähle die Art.",
    }),
    /** percentage: Basispunkte (1000 = 10 %), fixed_amount: Cent, free_shipping: 0 */
    value: z.number().int().min(0).default(0),
    minSubtotalCents: z.number().int().min(0).max(10_000_000).default(0),
    startsAt: dateOrNull.default(null),
    endsAt: dateOrNull.default(null),
    usageLimit: limitOrNull.default(null),
    usageLimitPerCustomer: limitOrNull.default(null),
    appliesTo: appliesToSchema.default({ scope: "order" }),
    combinable: z.boolean().default(false),
    customerType: z.enum(["b2c", "b2b"]).nullable().default(null),
    isActive: z.boolean().default(true),
  })
  .superRefine((d, ctx) => {
    if (d.kind === "percentage" && (d.value < 1 || d.value > 10_000)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Bitte zwischen 0,01 und 100 %." });
    }
    if (d.kind === "fixed_amount" && (d.value < 1 || d.value > 1_000_000)) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Bitte einen Betrag größer als 0 €.",
      });
    }
    if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Das Ende muss nach dem Start liegen.",
      });
    }
    if (
      d.usageLimit != null &&
      d.usageLimitPerCustomer != null &&
      d.usageLimitPerCustomer > d.usageLimit
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["usageLimitPerCustomer"],
        message: "Das Limit je Kunde kann nicht höher sein als das Gesamtlimit.",
      });
    }
    if (d.kind === "free_shipping" && d.appliesTo.scope !== "order") {
      ctx.addIssue({
        code: "custom",
        path: ["appliesTo"],
        message: "Versandkostenfrei gilt immer für die ganze Bestellung.",
      });
    }
  })
  .transform((d) => ({ ...d, value: d.kind === "free_shipping" ? 0 : d.value }));
export type DiscountInput = z.input<typeof discountInputSchema>;
export type ParsedDiscountInput = z.output<typeof discountInputSchema>;

/** Datenbankzeile, wie sie discount_codes liefert (Teilmenge). */
export interface DiscountRowLike {
  code: string;
  kind: DiscountKind;
  value: number;
  min_subtotal_cents: number;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  usage_limit_per_customer: number | null;
  usage_count: number;
  is_active: boolean;
}

/** Gleiche Abbildung wie toRule() im Checkout. productIds bereits aus applies_to aufgelöst. */
export function toPricingRule(
  row: DiscountRowLike,
  options: { customerUsageCount?: number; productIds?: string[] } = {},
): DiscountRule {
  return {
    code: row.code,
    kind: row.kind,
    value: row.value,
    minSubtotalCents: row.min_subtotal_cents,
    startsAt: row.starts_at ? new Date(row.starts_at) : null,
    endsAt: row.ends_at ? new Date(row.ends_at) : null,
    usageLimit: row.usage_limit,
    usageCount: row.usage_count,
    usageLimitPerCustomer: row.usage_limit_per_customer,
    customerUsageCount: options.customerUsageCount ?? 0,
    isActive: row.is_active,
    productIds: options.productIds,
  };
}

export type DiscountStatus = "active" | "scheduled" | "expired" | "exhausted" | "inactive";

export const DISCOUNT_STATUS_LABELS: Record<DiscountStatus, string> = {
  active: "Aktiv",
  scheduled: "Geplant",
  expired: "Abgelaufen",
  exhausted: "Aufgebraucht",
  inactive: "Deaktiviert",
};

/** Status für Liste und Detail, abgeleitet über validateDiscount (dieselbe Reihenfolge der Prüfungen). */
export function discountStatus(row: DiscountRowLike, now: Date = new Date()): DiscountStatus {
  const rejection = validateDiscount(toPricingRule(row), Number.MAX_SAFE_INTEGER, now);
  switch (rejection) {
    case "inactive":
      return "inactive";
    case "not_started":
      return "scheduled";
    case "expired":
      return "expired";
    case "usage_limit_reached":
      return "exhausted";
    default:
      return "active";
  }
}

/**
 * Vorschau "Was würde der Code bei diesem Warenkorb bewirken?" mit evaluateDiscount. Ohne
 * Positionen wird eine einzige Position mit dem angegebenen Warenwert angenommen.
 */
export function previewDiscount(
  rule: DiscountRule,
  input: { subtotalCents: number; lines?: PricedLine[] },
  now: Date = new Date(),
): DiscountEvaluation {
  const lines: PricedLine[] = input.lines ?? [
    {
      variantId: "preview",
      productId: rule.productIds?.[0] ?? "preview",
      quantity: 1,
      unitPriceCents: input.subtotalCents,
      unitDepositCents: 0,
      taxRateBp: 1900,
      weightGrams: 0,
    },
  ];
  return evaluateDiscount(rule, lines, now);
}

/** Kurzbeschreibung für Listen: "10 %", "5,00 €", "Versandkostenfrei", mit Mindestbestellwert. */
export function describeDiscount(
  row: Pick<DiscountRowLike, "kind" | "value" | "min_subtotal_cents">,
): string {
  const euro = (c: number) =>
    (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    " €";
  const main =
    row.kind === "percentage"
      ? `${(row.value / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`
      : row.kind === "fixed_amount"
        ? euro(row.value)
        : "Versandkostenfrei";
  return row.min_subtotal_cents > 0 ? `${main} ab ${euro(row.min_subtotal_cents)}` : main;
}

export const discountListFilterSchema = z.object({
  q: z.string().trim().max(60).optional(),
  status: z.enum(["all", "active", "scheduled", "expired", "exhausted", "inactive"]).default("all"),
});
export type DiscountListFilter = z.input<typeof discountListFilterSchema>;

/** E-Mail für Rollen ohne Kundenzugriff kürzen ("ma***@example.de"). */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Zeichen für generierte Codes, ohne leicht verwechselbare (0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Zufälligen Code erzeugen ("PV-7KQ3M9XA"), optional mit eigenem Präfix. Nutzt
 * crypto.getRandomValues (Browser und Node), damit Codes nicht erratbar sind.
 */
export function generateDiscountCode(prefix = "PV", length = 8): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let body = "";
  for (const b of bytes) body += CODE_ALPHABET[b % CODE_ALPHABET.length];
  const p = normalizeCode(prefix)
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  return p ? `${p}-${body}` : body;
}
