import "server-only";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import type { ImprintEntity } from "@/emails/components";
import { crmDb } from "@/lib/admin/customers/crm-db";

/**
 * Gemeinsame Angaben für alle CRM-Mails: Site-URL, Basis für Bilder aus Storage, Impressum aus
 * shop_settings (shop.legal_entity) und der Schalter der Allowlist (email.allowlist_active).
 */

export function siteUrl(): string {
  return (serverEnv().NEXT_PUBLIC_SITE_URL || publicEnv.siteUrl).replace(/\/$/, "");
}

export function imageBaseUrl(): string {
  const base = serverEnv().NEXT_PUBLIC_SUPABASE_URL || publicEnv.supabaseUrl;
  return base ? `${base.replace(/\/$/, "")}/storage/v1/object/public/media` : `${siteUrl()}/media`;
}

function campaignParam(campaignId?: string | null): string {
  return campaignId ? `&c=${encodeURIComponent(campaignId)}` : "";
}

/** Abmeldeseite (Link im Fuß jeder Werbemail), optional mit Kampagne für die Kennzahlen. */
export function unsubscribeUrlFor(token: string, campaignId?: string | null): string {
  return `${siteUrl()}/newsletter/abmelden?token=${encodeURIComponent(token)}${campaignParam(campaignId)}`;
}

/** One-Click-Abmeldung (POST, RFC 8058) für den Header List-Unsubscribe. */
export function oneClickUnsubscribeUrlFor(token: string, campaignId?: string | null): string {
  return `${siteUrl()}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}${campaignParam(campaignId)}`;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function loadImprint(): Promise<ImprintEntity | null> {
  const { data } = await crmDb()
    .from("shop_settings")
    .select("value")
    .eq("key", "shop.legal_entity")
    .maybeSingle();
  const v = data?.value;
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  return {
    name: str(r.name),
    street: str(r.street),
    zip: str(r.zip),
    city: str(r.city),
    email: str(r.email),
    managingDirector: str(r.managing_director) || undefined,
    register: str(r.register) || undefined,
    vatId: str(r.vat_id) || undefined,
  };
}

/** Allowlist aktiv, solange nicht ausdrücklich auf false gesetzt (Standard bis zum Go-live). */
export async function isAllowlistActive(): Promise<boolean> {
  const { data } = await crmDb()
    .from("shop_settings")
    .select("value")
    .eq("key", "email.allowlist_active")
    .maybeSingle();
  return data?.value !== false;
}
