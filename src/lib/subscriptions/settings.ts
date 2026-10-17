import "server-only";
import { supabaseAnon } from "@/lib/supabase/server";
import { aboDb } from "./db";
import { parseSubscriptionSettings } from "./rules";
import { DEFAULT_SUBSCRIPTION_SETTINGS, type SubscriptionSettings } from "./types";

/**
 * Abo-Einstellungen aus shop_settings (Schlüssel subscription_*). Fehlen Zeilen (zum Beispiel vor
 * dem Anwenden der Migration 20261017107000), gelten die Standardwerte aus types.ts.
 */
const KEYS = [
  "subscription_discount_bp",
  "subscription_product_discounts",
  "subscription_intervals",
  "subscription_reminder_days",
  "subscription_retry_days",
  "subscription_pause_max_days",
];

/** Alle Einstellungen, serverseitig mit Service Role (Abo-Lauf, Checkout, Backoffice). */
export async function loadSubscriptionSettings(): Promise<SubscriptionSettings> {
  try {
    const { data, error } = await aboDb()
      .from("shop_settings")
      .select("key, value")
      .in("key", KEYS);
    if (error) throw error;
    return parseSubscriptionSettings(
      Object.fromEntries(
        (data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]),
      ),
    );
  } catch (error) {
    console.error("[abo] Einstellungen nicht geladen, Standardwerte aktiv", error);
    return DEFAULT_SUBSCRIPTION_SETTINGS;
  }
}

/**
 * Öffentliche Einstellungen (Rabatt, Intervalle, maximale Pause) für statische Seiten über den
 * anon-Client (RLS: shop_settings.is_public). Erinnerung und Wiederholungen bleiben Standard.
 */
export async function loadPublicSubscriptionSettings(): Promise<SubscriptionSettings> {
  try {
    const { data, error } = await supabaseAnon()
      .from("shop_settings")
      .select("key, value")
      .in("key", KEYS);
    if (error) throw error;
    return parseSubscriptionSettings(Object.fromEntries((data ?? []).map((r) => [r.key, r.value])));
  } catch {
    return DEFAULT_SUBSCRIPTION_SETTINGS;
  }
}

/** Einstellung schreiben (Backoffice). Wert wird vorher in parseSubscriptionSettings geprüft. */
export async function saveSubscriptionSetting(key: string, value: unknown): Promise<void> {
  if (!KEYS.includes(key)) throw new Error(`Unbekannte Abo-Einstellung: ${key}`);
  const isPublic = !["subscription_reminder_days", "subscription_retry_days"].includes(key);
  const { error } = await aboDb()
    .from("shop_settings")
    .upsert({ key, value, is_public: isPublic, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Einstellung nicht gespeichert: ${error.message}`);
}
