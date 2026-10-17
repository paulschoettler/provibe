import { z } from "zod";

/**
 * Eingabeprüfung der Kontoformulare (serverseitig, Zod). Reine Logik ohne Datenbank, testbar.
 */

export const PASSWORD_MIN_LENGTH = 10;
/** bcrypt verarbeitet höchstens 72 Byte, Supabase lehnt längere Passwörter ab */
export const PASSWORD_MAX_LENGTH = 72;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Diese E-Mail-Adresse ist zu lang.")
  .email("Bitte gib eine gültige E-Mail-Adresse ein.");

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Dein Passwort braucht mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`)
  .max(PASSWORD_MAX_LENGTH, `Dein Passwort darf höchstens ${PASSWORD_MAX_LENGTH} Zeichen haben.`);

/** Honeypot: echte Menschen lassen das Feld leer */
export const honeypotSchema = z.string().max(0).optional();

export const magicLinkSchema = z.object({
  email: emailSchema,
  next: z.string().optional(),
  website: honeypotSchema,
});

export const passwordLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Bitte gib dein Passwort ein.").max(PASSWORD_MAX_LENGTH),
  next: z.string().optional(),
  website: honeypotSchema,
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    passwordRepeat: z.string(),
    website: honeypotSchema,
  })
  .refine((v) => v.password === v.passwordRepeat, {
    path: ["passwordRepeat"],
    message: "Die beiden Passwörter stimmen nicht überein.",
  });

export const setPasswordSchema = z
  .object({ password: passwordSchema, passwordRepeat: z.string() })
  .refine((v) => v.password === v.passwordRepeat, {
    path: ["passwordRepeat"],
    message: "Die beiden Passwörter stimmen nicht überein.",
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen.`)
    .transform((v) => (v.length === 0 ? null : v));

export const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Bitte gib deinen Vornamen ein.").max(80),
  lastName: optionalText(80),
  phone: optionalText(40).refine((v) => v === null || /^[+0-9 ()/-]{5,40}$/.test(v), {
    message: "Bitte gib eine gültige Telefonnummer ein.",
  }),
});

export const emailChangeSchema = z.object({ email: emailSchema });

/** Lieferländer: Deutschland aktiv, Österreich vorbereitet (Briefing 13) */
export const ADDRESS_COUNTRIES = { DE: "Deutschland", AT: "Österreich" } as const;
export type AddressCountry = keyof typeof ADDRESS_COUNTRIES;

export const addressSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    label: optionalText(40),
    firstName: z.string().trim().min(1, "Bitte gib den Vornamen ein.").max(80),
    lastName: z.string().trim().min(1, "Bitte gib den Nachnamen ein.").max(80),
    company: optionalText(120),
    street: z.string().trim().min(2, "Bitte gib die Straße ein.").max(120),
    houseNumber: z.string().trim().min(1, "Bitte gib die Hausnummer ein.").max(20),
    addressAddition: optionalText(120),
    postalCode: z.string().trim().min(4, "Bitte gib die Postleitzahl ein.").max(10),
    city: z.string().trim().min(2, "Bitte gib den Ort ein.").max(80),
    countryCode: z.enum(["DE", "AT"], "Bitte wähle ein Land."),
    phone: optionalText(40),
    isDefaultShipping: z.boolean(),
    isDefaultBilling: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const pattern = v.countryCode === "DE" ? /^\d{5}$/ : /^\d{4}$/;
    if (!pattern.test(v.postalCode)) {
      ctx.addIssue({
        code: "custom",
        path: ["postalCode"],
        message:
          v.countryCode === "DE"
            ? "Deutsche Postleitzahlen haben fünf Ziffern."
            : "Österreichische Postleitzahlen haben vier Ziffern.",
      });
    }
  });

export type AddressInput = z.infer<typeof addressSchema>;

/** Erste Meldung je Feld aus einem Zod-Fehler, für aria-describedby */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Formularwerte als einfache Strings (für die Rückgabe an das Formular ohne Passwörter) */
export function formValues(formData: FormData, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) out[key] = String(formData.get(key) ?? "");
  return out;
}
