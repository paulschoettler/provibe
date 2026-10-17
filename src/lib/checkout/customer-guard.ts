import "server-only";
import { checkoutDb } from "./db";

/** Meldung für gesperrte Kunden: keine Details, kein Grund (der steht nur im Backoffice). */
export const BLOCKED_CUSTOMER_MESSAGE =
  "Diese Bestellung können wir gerade nicht annehmen. Bitte melde dich bei hello@provibe-drinks.de.";

/**
 * Im Backoffice gesperrte Kunden (customers.blocked_at, Migration 20261017204000) dürfen nicht
 * bestellen. Die Prüfung läuft serverseitig unmittelbar vor der Zahlung, damit eine Sperre auch
 * eine bereits geöffnete Kasse erfasst. Ohne E-Mail oder ohne Kundendatensatz gilt: nicht gesperrt.
 */
export async function isCustomerBlocked(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const { data, error } = await checkoutDb()
    .from("customers")
    .select("blocked_at")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`Kundensperre nicht prüfbar: ${error.message}`);
  return !!data?.blocked_at;
}
