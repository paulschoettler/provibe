import { list, str, type FormObject } from "@/lib/admin/products/form";
import type { FieldErrors } from "@/lib/admin/products/result";
import {
  generateDiscountCode,
  parseEuroToCents,
  parsePercentToBasisPoints,
  type DiscountInput,
} from "./rules";

/**
 * Formular des Rabatt-Editors (rein, ohne Server). Zeiten tippt man als Ortszeit Berlin
 * (datetime-local), gespeichert wird UTC. Beträge in Euro, Prozent als Zahl.
 */

export const BERLIN = "Europe/Berlin";

/** Abstand Berlin zu UTC in Minuten zum Zeitpunkt date (Sommerzeit beachtet). */
function berlinOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BERLIN,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** "2026-12-24T18:00" (Berlin) → ISO in UTC; leer → null; ungültig → undefined */
export function berlinLocalToIso(local: string): string | null | undefined {
  if (!local) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/.exec(local);
  if (!m) return undefined;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let ts = guess - berlinOffsetMinutes(new Date(guess)) * 60000;
  const second = berlinOffsetMinutes(new Date(ts));
  ts = guess - second * 60000;
  return new Date(ts).toISOString();
}

/** ISO (UTC) → "YYYY-MM-DDTHH:mm" in Berlin für <input type="datetime-local"> */
export function isoToBerlinLocal(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() + berlinOffsetMinutes(d) * 60000);
  return local.toISOString().slice(0, 16);
}

export interface ParsedDiscountForm {
  discount: DiscountInput;
  errors: FieldErrors;
  generated: boolean;
}

export function parseDiscountForm(obj: FormObject): ParsedDiscountForm {
  const errors: FieldErrors = {};
  const kind = str(obj, "kind") as DiscountInput["kind"];
  if (!["percentage", "fixed_amount", "free_shipping"].includes(kind))
    errors.kind = "Bitte wähle die Art.";
  let value = 0;
  if (kind === "percentage") {
    const bp = parsePercentToBasisPoints(str(obj, "valuePercent"));
    if (bp == null) errors.valuePercent = "Bitte zwischen 0,01 und 100 % angeben.";
    else value = bp;
  } else if (kind === "fixed_amount") {
    const c = parseEuroToCents(str(obj, "valueAmount"));
    if (c == null || c < 1) errors.valueAmount = "Bitte einen Betrag wie 5,00 eingeben.";
    else value = c;
  }
  const minRaw = str(obj, "minSubtotal");
  const min = minRaw ? parseEuroToCents(minRaw) : 0;
  if (min == null) errors.minSubtotal = "Bitte einen Betrag wie 30,00 eingeben.";

  const startsAt = berlinLocalToIso(str(obj, "startsAt"));
  if (startsAt === undefined) errors.startsAt = "Bitte ein gültiges Datum mit Uhrzeit.";
  const endsAt = berlinLocalToIso(str(obj, "endsAt"));
  if (endsAt === undefined) errors.endsAt = "Bitte ein gültiges Datum mit Uhrzeit.";

  const limit = (name: string): number | null => {
    const raw = str(obj, name);
    if (!raw) return null;
    if (!/^\d+$/.test(raw)) {
      errors[name] = "Nur ganze Zahlen.";
      return null;
    }
    return Number(raw);
  };

  const scope = str(obj, "scope");
  const appliesTo: DiscountInput["appliesTo"] =
    scope === "products"
      ? { scope: "products", ids: list(obj, "productIds") }
      : scope === "collections"
        ? { scope: "collections", ids: list(obj, "collectionIds") }
        : { scope: "order" };

  let code = str(obj, "code");
  let generated = false;
  if (!code || str(obj, "intent") === "generate") {
    code = generateDiscountCode(str(obj, "codePrefix") || "PV");
    generated = true;
  }
  const customerType = str(obj, "customerType");

  return {
    discount: {
      id: str(obj, "id") || undefined,
      code,
      title: str(obj, "title") || null,
      kind,
      value,
      minSubtotalCents: min ?? 0,
      startsAt: startsAt ?? null,
      endsAt: endsAt ?? null,
      usageLimit: limit("usageLimit"),
      usageLimitPerCustomer: limit("usageLimitPerCustomer"),
      appliesTo,
      combinable: "combinable" in obj,
      customerType: customerType === "b2c" || customerType === "b2b" ? customerType : null,
      isActive: "isActive" in obj,
    } as DiscountInput,
    errors,
    generated,
  };
}
