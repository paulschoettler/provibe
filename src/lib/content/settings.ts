import { cache } from "react";
import { supabaseAnon } from "@/lib/supabase/server";

/** Öffentliche Shopdaten aus shop_settings (is_public), Seed part1. */
export interface LegalEntity {
  name: string;
  street: string;
  zip: string;
  city: string;
  email: string;
  phone: string;
  vatId: string;
  register: string;
  managingDirector: string;
  /** LUCID-Registrierungsnummer (Verpackungsregister), leer bis sie vorliegt (B13, H8) */
  lucidNumber: string;
}

export interface ShopContact {
  email: string;
  partnerEmail: string;
  supportEmail: string;
  phone: string;
}

export interface ShopSettings {
  legalEntity: LegalEntity;
  contact: ShopContact;
  social: { instagram: string; tiktok: string };
}

/** Rückfall, falls die Tabelle nicht erreichbar ist: Werte aus dem Impressum (Stand Seed). */
const FALLBACK: ShopSettings = {
  legalEntity: {
    name: "CG Projects UG (haftungsbeschränkt)",
    street: "Kurt-Viermetz-Straße 1a",
    zip: "86150",
    city: "Augsburg",
    email: "hello@provibe-drinks.de",
    phone: "+491629231702",
    vatId: "DE457662597",
    register: "Amtsgericht Augsburg, HRB 41818",
    managingDirector: "Celine Grimm",
    lucidNumber: "",
  },
  contact: {
    email: "hello@provibe-drinks.de",
    partnerEmail: "partner@provibe-drinks.de",
    supportEmail: "support@provibe-drinks.de",
    phone: "+491629231702",
  },
  social: {
    instagram: "https://www.instagram.com/provibe.de",
    tiktok: "https://www.tiktok.com/@provibe.de",
  },
};

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);

export const getShopSettings = cache(async (): Promise<ShopSettings> => {
  const { data, error } = await supabaseAnon()
    .from("shop_settings")
    .select("key, value")
    .in("key", ["shop.legal_entity", "shop.contact", "shop.social"]);
  if (error || !data) {
    if (error) console.error("[settings] shop_settings nicht ladbar", error);
    return FALLBACK;
  }
  const map = Object.fromEntries(data.map((r) => [r.key, rec(r.value)]));
  const le = map["shop.legal_entity"] ?? {};
  const c = map["shop.contact"] ?? {};
  const s = map["shop.social"] ?? {};
  const f = FALLBACK;
  return {
    legalEntity: {
      name: str(le.name, f.legalEntity.name),
      street: str(le.street, f.legalEntity.street),
      zip: str(le.zip, f.legalEntity.zip),
      city: str(le.city, f.legalEntity.city),
      email: str(le.email, f.legalEntity.email),
      phone: str(le.phone, f.legalEntity.phone),
      vatId: str(le.vat_id, f.legalEntity.vatId),
      register: str(le.register, f.legalEntity.register),
      managingDirector: str(le.managing_director, f.legalEntity.managingDirector),
      lucidNumber: str(le.lucid_number, "").trim(),
    },
    contact: {
      email: str(c.email, f.contact.email),
      partnerEmail: str(c.partner_email, f.contact.partnerEmail),
      supportEmail: str(c.support_email, f.contact.supportEmail),
      phone: str(c.phone, f.contact.phone),
    },
    social: {
      instagram: str(s.instagram, f.social.instagram),
      tiktok: str(s.tiktok, f.social.tiktok),
    },
  };
});

/** Rücksendeadresse laut H5 (Annahme: Anschrift aus dem Impressum). */
export function returnAddress(le: LegalEntity): string {
  return `${le.name}, ${le.street}, ${le.zip} ${le.city}`;
}
