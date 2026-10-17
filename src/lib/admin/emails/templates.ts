import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { assertPermission, parseInput } from "@/lib/admin/customers/guard";
import { isCrmTemplateKey, renderCrmTemplate, type RenderedMail } from "@/emails";
import {
  internalNotificationEmail,
  orderConfirmationEmail,
  paymentConfirmationEmail,
  type LegalEntity,
} from "@/lib/checkout/emails";
import type { Json } from "@/lib/supabase/database.types";
import { refundEmail, shippingEmail } from "@/lib/admin/orders/emails";
import { imageBaseUrl, loadImprint, siteUrl } from "./context";
import { sampleOrderView } from "./preview-fixtures";

/**
 * Vorlagenübersicht fürs Backoffice (/admin/emails). Inhalt der Vorlagen liegt im Code:
 *   crm      src/emails/* (dieses Paket)
 *   checkout src/lib/checkout/emails.ts (nur Vorschau mit Beispielbestellung)
 *   orders   src/lib/admin/orders/emails.ts (Versandbestätigung, Erstattung; nur Vorschau)
 *   konto    src/lib/auth/mails.ts (keine reine Renderfunktion, daher ohne Vorschau)
 *   auth     Supabase Auth (Vorlage im Supabase-Dashboard)
 */

export type TemplateSource = "crm" | "checkout" | "orders" | "konto" | "supabase_auth";

const CHECKOUT_KEYS = ["order_confirmation", "payment_confirmation", "order_internal_notification"];
const ORDERS_KEYS = ["shipping_confirmation", "refund_confirmation"];
const KONTO_KEYS = [
  "newsletter_double_opt_in",
  "account_activate",
  "account_email_changed",
  "account_deleted",
];
const AUTH_KEYS = ["auth_magic_link", "auth_password_reset"];

export function templateSource(key: string): TemplateSource {
  if (isCrmTemplateKey(key)) return "crm";
  if (CHECKOUT_KEYS.includes(key)) return "checkout";
  if (ORDERS_KEYS.includes(key)) return "orders";
  if (KONTO_KEYS.includes(key)) return "konto";
  if (AUTH_KEYS.includes(key)) return "supabase_auth";
  return "checkout";
}

export interface EmailTemplateRow {
  key: string;
  name: string;
  description: string | null;
  category: "transactional" | "marketing" | "auth" | "internal";
  subjectTemplate: string;
  previewProps: Json;
  isEnabled: boolean;
  updatedAt: string;
  source: TemplateSource;
  previewable: boolean;
  /** Nur Werbe-Vorlagen des CRM lassen sich abschalten, Pflichtmails nicht */
  toggleable: boolean;
  sentLast30Days: number;
}

export async function listEmailTemplates(): Promise<EmailTemplateRow[]> {
  const db = crmDb();
  const { data, error } = await db
    .from("email_templates")
    .select("*")
    .order("category")
    .order("name");
  if (error) throw dbError("Vorlagen laden", error);
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const counts = await Promise.all(
    (data ?? []).map(async (t) => {
      const { count } = await db
        .from("email_messages")
        .select("id", { count: "exact", head: true })
        .eq("template", t.key)
        .in("status", ["sent", "delivered"])
        .gte("created_at", since);
      return count ?? 0;
    }),
  );
  return (data ?? []).map((t, i) => {
    const source = templateSource(t.key);
    return {
      key: t.key,
      name: t.name,
      description: t.description,
      category: t.category,
      subjectTemplate: t.subject_template,
      previewProps: t.preview_props,
      isEnabled: t.is_enabled,
      updatedAt: t.updated_at,
      source,
      previewable: source === "crm" || source === "checkout" || source === "orders",
      toggleable: source === "crm" && t.category === "marketing" && t.key !== "newsletter_campaign",
      sentLast30Days: counts[i],
    };
  });
}

function checkoutEntity(e: Awaited<ReturnType<typeof loadImprint>>): LegalEntity | null {
  if (!e) return null;
  return {
    name: e.name,
    street: e.street,
    zip: e.zip,
    city: e.city,
    email: e.email,
    vat_id: e.vatId,
    register: e.register,
    managing_director: e.managingDirector,
  };
}

/**
 * Vorlage mit Beispiel- oder übergebenen Props rendern (Vorschau). null, wenn die Vorlage im
 * Konto-Paket oder bei Supabase Auth liegt und keine reine Renderfunktion hat.
 */
export async function renderTemplate(
  key: string,
  props: Record<string, unknown> = {},
): Promise<(RenderedMail & { source: TemplateSource }) | null> {
  const url = siteUrl();
  const entity = await loadImprint();
  const source = templateSource(key);
  if (isCrmTemplateKey(key)) {
    const mail = renderCrmTemplate(key, props, {
      entity,
      siteUrl: url,
      imageBaseUrl: imageBaseUrl(),
      unsubscribeUrl: `${url}/newsletter/abmelden?token=vorschau`,
      testBanner: "VORSCHAU",
    });
    return { ...mail, source };
  }
  const orderNumber = typeof props.order_number === "string" ? props.order_number : "PV-10001";
  const order = sampleOrderView(url, orderNumber);
  switch (key) {
    case "order_confirmation":
      return {
        ...orderConfirmationEmail(
          order,
          {
            agb: {
              title: "Allgemeine Geschäftsbedingungen",
              bodyHtml: "<p>(Wortlaut der gültigen Fassung)</p>",
            },
            widerruf: {
              title: "Widerrufsbelehrung",
              bodyHtml: "<p>(Wortlaut der gültigen Fassung)</p>",
            },
          },
          checkoutEntity(entity),
          url,
        ),
        source,
      };
    case "payment_confirmation":
      return { ...paymentConfirmationEmail(order, checkoutEntity(entity)), source };
    case "order_internal_notification":
      return { ...internalNotificationEmail(order, url), source };
    case "shipping_confirmation":
      return {
        ...shippingEmail({
          orderNumber,
          firstName: "Max",
          carrierLabel: "DHL",
          trackingNumber: "00340434161094000000",
          trackingUrl: "https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html",
          items: order.items.map((i) => ({
            title: i.title,
            description: i.description,
            quantity: i.quantity,
          })),
          addressLines: ["Max Muster", "Beispielstraße 12", "86150 Augsburg"],
          isTest: true,
          entity: checkoutEntity(entity),
        }),
        source,
      };
    case "refund_confirmation":
      return {
        ...refundEmail({
          orderNumber,
          firstName: "Max",
          amountCents: 2610,
          lines: [{ title: "Peach Eistee (9 Dosen)", quantity: 1, amountCents: 2610 }],
          shippingCents: 0,
          isFull: false,
          paymentLabel: order.paymentLabel,
          isTest: true,
          entity: checkoutEntity(entity),
        }),
        source,
      };
    default:
      return null;
  }
}

const toggleSchema = z.object({ key: z.string().min(1).max(80), enabled: z.boolean() });

/** Werbe-Vorlage des CRM an- oder abschalten (Automationen prüfen den Schalter vor dem Versand). */
export async function setTemplateEnabled(
  input: { key: string; enabled: boolean },
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "sendNewsletter");
  const { key, enabled } = parseInput(toggleSchema, input);
  const db = crmDb();
  const { data: before } = await db
    .from("email_templates")
    .select("key, category, is_enabled")
    .eq("key", key)
    .maybeSingle();
  if (!before) throw new Error("Vorlage nicht gefunden");
  if (
    templateSource(key) !== "crm" ||
    before.category !== "marketing" ||
    key === "newsletter_campaign"
  )
    throw new Error("Pflichtmails lassen sich nicht abschalten");
  const { error } = await db.from("email_templates").update({ is_enabled: enabled }).eq("key", key);
  if (error) throw dbError("Vorlage speichern", error);
  await writeAudit(actor, {
    action: "email_template.toggle",
    entityType: "email_template",
    entityId: key,
    before: { is_enabled: before.is_enabled },
    after: { is_enabled: enabled },
  });
}

/** Ist eine Vorlage eingeschaltet? Unbekannte Vorlagen gelten als eingeschaltet. */
export async function isTemplateEnabled(key: string): Promise<boolean> {
  const { data } = await crmDb()
    .from("email_templates")
    .select("is_enabled")
    .eq("key", key)
    .maybeSingle();
  return data?.is_enabled !== false;
}
