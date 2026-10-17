import { z } from "zod";

/**
 * Zod-Schemas der Inhaltsformulare (Partner, Kontakt, Widerruf). Rein, ohne Server-Abhängigkeiten,
 * damit sie testbar sind und Client wie Server dieselben Optionen kennen.
 * Fehlermeldungen in Du-Form, konkret und ohne Fachjargon.
 */

const trimmed = (max: number) => z.string().trim().max(max, `Bitte höchstens ${max} Zeichen.`);

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Bitte prüfe deine E-Mail-Adresse.")
  .email("Bitte prüfe deine E-Mail-Adresse.");

/** Honeypot: echte Menschen lassen das Feld leer. */
export const honeypot = z.string().max(0).optional().or(z.literal(""));

export const BUSINESS_TYPES = [
  { value: "gym", label: "Gym oder Fitnessstudio" },
  { value: "functional-training", label: "Functional Training" },
  { value: "einzelhandel", label: "Einzelhandel" },
  { value: "gastronomie", label: "Gastronomie" },
  { value: "hotellerie", label: "Hotellerie" },
  { value: "sonstiges", label: "Sonstiges" },
] as const;

export const CONTACT_SUBJECTS = [
  { value: "bestellung", label: "Bestellung" },
  { value: "produkt", label: "Produkt" },
  { value: "partnerschaft", label: "Partnerschaft" },
  { value: "sonstiges", label: "Sonstiges" },
] as const;

type Values<T extends readonly { value: string }[]> = T[number]["value"];
const values = <T extends readonly { value: string }[]>(list: T) =>
  list.map((o) => o.value) as [Values<T>, ...Values<T>[]];

export function labelFor(list: readonly { value: string; label: string }[], value: string): string {
  return list.find((o) => o.value === value)?.label ?? value;
}

export const partnerSchema = z.object({
  company: trimmed(160).min(2, "Bitte gib den Namen deines Geschäfts ein."),
  contactName: trimmed(120).min(2, "Bitte gib deinen Namen ein."),
  email,
  phone: trimmed(40)
    .regex(/^[0-9+()\s/-]*$/, "Bitte gib nur Ziffern, Leerzeichen und + ein.")
    .optional()
    .or(z.literal("")),
  businessType: z.enum(values(BUSINESS_TYPES), {
    message: "Bitte wähle die Art deines Geschäfts.",
  }),
  message: trimmed(4000).min(10, "Erzähl uns kurz, worum es geht (mindestens 10 Zeichen)."),
  website: honeypot,
});
export type PartnerInput = z.infer<typeof partnerSchema>;

export const contactSchema = z.object({
  name: trimmed(120).min(2, "Bitte gib deinen Namen ein."),
  email,
  subject: z.enum(values(CONTACT_SUBJECTS), { message: "Bitte wähle einen Betreff." }),
  message: trimmed(4000).min(10, "Bitte schreib uns ein paar Worte mehr (mindestens 10 Zeichen)."),
  website: honeypot,
});
export type ContactInput = z.infer<typeof contactSchema>;

export const withdrawalLookupSchema = z.object({
  orderNumber: trimmed(40).min(3, "Bitte gib deine Bestellnummer ein."),
  email,
});

export const withdrawalSchema = z
  .object({
    orderNumber: trimmed(40).min(3, "Bitte gib deine Bestellnummer ein."),
    email,
    name: trimmed(120).min(2, "Bitte gib deinen Namen ein."),
    items: z.array(trimmed(200)).max(50).default([]),
    itemsText: trimmed(2000).optional().or(z.literal("")),
    reason: trimmed(2000).optional().or(z.literal("")),
    website: honeypot,
  })
  .refine((d) => d.items.length > 0 || (d.itemsText ?? "").length >= 2, {
    path: ["itemsText"],
    message: "Bitte gib an, welche Artikel du widerrufen möchtest.",
  });
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;

/** Bestellnummer vereinheitlichen: "#1042", "pv-001042" → "PV-001042" bzw. "1042". */
export function normalizeOrderNumber(raw: string): string {
  const s = raw.trim().replace(/^#/, "").toUpperCase();
  return s;
}

/** Erste Fehlermeldung je Feld aus einem ZodError. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
