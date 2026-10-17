import { formatEur, roundHalfAwayFromZero } from "@/lib/money";

/**
 * Erstattungsbetrag aus den Positions-Snapshots (order_items), nie aus dem Katalog.
 * Je erstatteter Einheit: Preis + Pfand − anteiliger Rabatt. Der Rabattanteil wird kumulativ
 * verteilt (Anteil nach n Einheiten = round(Rabatt × n / Menge)), damit Teilerstattungen in
 * Summe exakt den Positionsrabatt ergeben und keine Rundungscents verloren gehen.
 */

export interface RefundableItem {
  id: string;
  title: string;
  quantity: number;
  refundedQuantity: number;
  unitPriceCents: number;
  unitDepositCents: number;
  /** anteilig zugeordneter Rabatt der ganzen Position */
  discountCents: number;
}

export interface RefundOrderState {
  totalCents: number;
  shippingCents: number;
  /** Summe aller bisherigen Erstattungen (succeeded und pending) */
  refundedCents: number;
  /** davon Versandkosten */
  refundedShippingCents: number;
  items: RefundableItem[];
}

export interface RefundRequestLine {
  orderItemId: string;
  quantity: number;
}

export interface RefundRequest {
  lines: RefundRequestLine[];
  shippingCents?: number;
  /** Abweichender Betrag (zum Beispiel Kulanz); höchstens der noch erstattbare Rest */
  amountCents?: number;
}

export interface RefundLineCalc {
  orderItemId: string;
  title: string;
  quantity: number;
  priceCents: number;
  depositCents: number;
  discountCents: number;
  amountCents: number;
}

export interface RefundComputation {
  lines: RefundLineCalc[];
  shippingCents: number;
  /** Vorschlag aus Positionen und Versand */
  suggestedCents: number;
  /** tatsächlich zu erstattender Betrag */
  amountCents: number;
  /** noch erstattbar vor dieser Erstattung */
  remainingBeforeCents: number;
  remainingAfterCents: number;
  /** danach ist die Zahlung vollständig erstattet */
  isFull: boolean;
  /** Betrag wurde von Hand gesetzt und weicht vom Vorschlag ab */
  overridden: boolean;
}

export type RefundCalcResult =
  { ok: true; value: RefundComputation } | { ok: false; error: string };

/** Rabattanteil der ersten n Einheiten einer Position. */
export function discountShare(discountCents: number, quantity: number, units: number): number {
  if (quantity <= 0 || units <= 0) return 0;
  if (units >= quantity) return discountCents;
  return roundHalfAwayFromZero((discountCents * units) / quantity);
}

/** Betrag für k Einheiten einer Position, nachdem bereits r Einheiten erstattet wurden. */
export function refundLineAmount(item: RefundableItem, units: number): RefundLineCalc {
  const r = item.refundedQuantity;
  const priceCents = units * item.unitPriceCents;
  const depositCents = units * item.unitDepositCents;
  const discountCents =
    discountShare(item.discountCents, item.quantity, r + units) -
    discountShare(item.discountCents, item.quantity, r);
  return {
    orderItemId: item.id,
    title: item.title,
    quantity: units,
    priceCents,
    depositCents,
    discountCents,
    amountCents: priceCents + depositCents - discountCents,
  };
}

export function computeRefund(state: RefundOrderState, req: RefundRequest): RefundCalcResult {
  const byId = new Map(state.items.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const lines: RefundLineCalc[] = [];

  for (const line of req.lines) {
    if (line.quantity === 0) continue;
    if (!Number.isInteger(line.quantity) || line.quantity < 0) {
      return { ok: false, error: "Die Menge muss eine ganze Zahl sein." };
    }
    if (seen.has(line.orderItemId)) {
      return { ok: false, error: "Eine Position ist doppelt angegeben." };
    }
    seen.add(line.orderItemId);
    const item = byId.get(line.orderItemId);
    if (!item) return { ok: false, error: "Die Position gehört nicht zu dieser Bestellung." };
    const open = item.quantity - item.refundedQuantity;
    if (line.quantity > open) {
      return {
        ok: false,
        error: `${item.title}: höchstens ${open} von ${item.quantity} noch erstattbar.`,
      };
    }
    lines.push(refundLineAmount(item, line.quantity));
  }

  const shippingCents = req.shippingCents ?? 0;
  if (!Number.isInteger(shippingCents) || shippingCents < 0) {
    return { ok: false, error: "Versandkosten müssen ein Betrag in Cent sein." };
  }
  const shippingOpen = Math.max(0, state.shippingCents - state.refundedShippingCents);
  if (shippingCents > shippingOpen) {
    return { ok: false, error: "Die Versandkosten sind bereits erstattet oder niedriger." };
  }

  const suggestedCents = lines.reduce((s, l) => s + l.amountCents, 0) + shippingCents;
  const remainingBeforeCents = Math.max(0, state.totalCents - state.refundedCents);
  const amountCents = req.amountCents ?? suggestedCents;

  if (!Number.isInteger(amountCents)) {
    return { ok: false, error: "Der Betrag muss eine ganze Zahl in Cent sein." };
  }
  if (amountCents <= 0) {
    return {
      ok: false,
      error: "Bitte wähle Positionen oder Versandkosten aus oder gib einen Betrag an.",
    };
  }
  if (amountCents > remainingBeforeCents) {
    return {
      ok: false,
      error: `Höchstens ${formatEur(remainingBeforeCents)} sind noch erstattbar.`,
    };
  }

  return {
    ok: true,
    value: {
      lines,
      shippingCents,
      suggestedCents,
      amountCents,
      remainingBeforeCents,
      remainingAfterCents: remainingBeforeCents - amountCents,
      isFull: remainingBeforeCents - amountCents === 0,
      overridden: req.amountCents !== undefined && req.amountCents !== suggestedCents,
    },
  };
}

/** Gespeicherte Form in refunds.items (jsonb): Positionen plus optional eine Versandzeile. */
export type StoredRefundItem =
  | {
      type: "item";
      order_item_id: string;
      quantity: number;
      price_cents: number;
      deposit_cents: number;
      discount_cents: number;
      amount_cents: number;
    }
  | { type: "shipping"; amount_cents: number };

export function toStoredRefundItems(calc: RefundComputation): StoredRefundItem[] {
  const out: StoredRefundItem[] = calc.lines.map((l) => ({
    type: "item",
    order_item_id: l.orderItemId,
    quantity: l.quantity,
    price_cents: l.priceCents,
    deposit_cents: l.depositCents,
    discount_cents: l.discountCents,
    amount_cents: l.amountCents,
  }));
  if (calc.shippingCents > 0) out.push({ type: "shipping", amount_cents: calc.shippingCents });
  return out;
}

/** Bereits erstattete Versandkosten aus refunds.items lesen (tolerant gegenüber Altformaten). */
export function refundedShippingFromItems(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum: number, raw) => {
    const i = raw as { type?: string; amount_cents?: unknown };
    return i?.type === "shipping" && typeof i.amount_cents === "number"
      ? sum + i.amount_cents
      : sum;
  }, 0);
}
