import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { publicEnv } from "@/lib/env/public";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { kontoRpc } from "./db";
import { loginUrl } from "./redirect";

/**
 * Session und Kundendatensatz. Die Session steckt in httpOnly-Cookies (@supabase/ssr),
 * getUser() prüft das Token beim Auth-Server, statt dem Cookie blind zu vertrauen.
 */

export interface CurrentCustomer {
  id: string;
  authUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  createdAt: string;
  /** E-Mail-Adresse der Session (kann während eines E-Mail-Wechsels abweichen) */
  authEmail: string | null;
  /** Neue Adresse, deren Bestätigung noch aussteht */
  pendingEmail: string | null;
}

const CUSTOMER_COLUMNS = "id, auth_user_id, email, first_name, last_name, phone, created_at";

type CustomerRow = {
  id: string;
  auth_user_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
};

/** Aktueller Auth-Benutzer oder null. Einmal je Request (React cache). */
export const getSessionUser = cache(async (): Promise<User | null> => {
  if (!publicEnv.supabaseUrl || !publicEnv.supabasePublishableKey) return null;
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user ?? null;
  } catch {
    return null;
  }
});

/**
 * Kunde zum Auth-Benutzer anlegen oder per E-Mail verknüpfen und Gastbestellungen zuordnen.
 * Verknüpft wird nur mit bestätigter E-Mail (sonst könnte jemand mit einer fremden Adresse
 * fremde Bestellungen sehen). Idempotent, läuft nach jedem Login.
 */
export async function ensureCustomerForUser(user: User): Promise<string | null> {
  if (!user.email) return null;
  const { data, error } = await kontoRpc<string>("link_auth_user_to_customer", {
    p_user_id: user.id,
    p_email: user.email,
    p_confirmed: Boolean(user.email_confirmed_at),
    p_meta: user.user_metadata ?? {},
  });
  if (error) {
    console.error("[auth] Kunde konnte nicht verknüpft werden", error.message);
    return null;
  }
  return data;
}

function toCustomer(row: CustomerRow, user: User): CurrentCustomer {
  return {
    id: row.id,
    authUserId: user.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    createdAt: row.created_at,
    authEmail: user.email ?? null,
    pendingEmail: user.new_email ?? null,
  };
}

/** Kunde der aktuellen Session oder null (nicht eingeloggt oder E-Mail unbestätigt). */
export const getCurrentCustomer = cache(async (): Promise<CurrentCustomer | null> => {
  const user = await getSessionUser();
  if (!user || !user.email_confirmed_at) return null;

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (data) return toCustomer(data as CustomerRow, user);

  // Erster Aufruf nach dem Login (oder Trigger hat nicht gegriffen): jetzt verknüpfen
  const id = await ensureCustomerForUser(user);
  if (!id) return null;
  const { data: linked } = await supabaseAdmin()
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("id", id)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return linked ? toCustomer(linked as CustomerRow, user) : null;
});

/** Für geschützte Kontoseiten: ohne Kunde geht es zum Login mit Rücksprung. */
export async function requireCustomer(path: string): Promise<CurrentCustomer> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect(loginUrl(path));
  return customer;
}

/** Anzeigename für Begrüßung und Header */
export function displayFirstName(customer: Pick<CurrentCustomer, "firstName" | "email">): string {
  const first = customer.firstName?.trim();
  if (first) return first;
  return "";
}
