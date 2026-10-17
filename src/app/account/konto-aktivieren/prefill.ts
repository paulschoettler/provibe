import { emailSchema } from "@/lib/auth/validation";

/**
 * Vorbelegung des E-Mail-Feldes aus ?email=… (Link aus der Massenmail "Konto aktivieren").
 * Nur gültige Adressen, sonst bleibt das Feld leer. Es passiert nichts ohne Absenden.
 */
export function prefillEmail(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const parsed = emailSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}
