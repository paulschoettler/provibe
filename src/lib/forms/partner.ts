"use server";

import { redirect } from "next/navigation";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildGenerateLeadEvent, emitTrackingEvent } from "@/lib/tracking/events";
import { echoValues, isTestAddress, readFields, sendMail, setSummaryCookie } from "./common";
import { partnerConfirmationMail, partnerInternalMail } from "./emails";
import { BUSINESS_TYPES, fieldErrors, labelFor, partnerSchema } from "./schemas";
import { FORM_ERROR_TEXT, FORM_FAILURE_TEXT, type FormState } from "./state";

const FIELDS = [
  "company",
  "contactName",
  "email",
  "phone",
  "businessType",
  "message",
  "website",
] as const;
const PARTNER_SENT_PATH = "/pages/partner/gesendet";

/**
 * Partneranfrage (B2B-Lead, Briefing 3 und 8): validiert mit Zod, Honeypot, Rate Limit,
 * schreibt in leads (kind = "partner") mit dem Service-Role-Client (anon hat keinen
 * Schreibzugriff), schickt eine interne Mail an partner@ und eine Eingangsbestätigung,
 * leitet dann auf die Seite "gesendet" weiter (funktioniert ohne JavaScript).
 */
export async function submitPartnerForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readFields(formData, FIELDS);
  // Honeypot gefüllt: still beenden, für Bots sieht es nach Erfolg aus (kein Eintrag, keine Mail)
  if (raw.website) redirect(PARTNER_SENT_PATH);
  const parsed = partnerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: FORM_ERROR_TEXT,
      fieldErrors: fieldErrors(parsed.error),
      values: echoValues(raw),
    };
  }
  const d = parsed.data;

  const limit = await checkRateLimit({ action: "partner", limit: 5, windowSeconds: 3600 });
  if (!limit.allowed) {
    return { status: "error", message: RATE_LIMIT_MESSAGE, values: echoValues(raw) };
  }

  const businessLabel = labelFor(BUSINESS_TYPES, d.businessType);
  let leadId: string;
  try {
    const { data, error } = await supabaseAdmin()
      .from("leads")
      .insert({
        kind: "partner",
        company: d.company,
        contact_name: d.contactName,
        email: d.email,
        phone: d.phone || null,
        location_type: businessLabel,
        message: d.message,
        source_url: "/pages/partner",
        attribution: isTestAddress(d.email)
          ? { source: "partner", note: "TEST" }
          : { source: "partner" },
        ip_hash: limit.ipHash,
      })
      .select("id")
      .single();
    if (error) throw error;
    leadId = data.id;
  } catch (error) {
    console.error("[forms] Partneranfrage konnte nicht gespeichert werden", error);
    return { status: "error", message: FORM_FAILURE_TEXT, values: echoValues(raw) };
  }

  const mailData = {
    company: d.company,
    contactName: d.contactName,
    email: d.email,
    phone: d.phone ?? "",
    businessType: businessLabel,
    message: d.message,
  };
  await Promise.all([
    sendMail("partner@provibe-drinks.de", partnerInternalMail(mailData, leadId), {
      category: "internal",
      template: "partner_lead_internal",
      replyTo: d.email,
      idempotencyKey: `partner-internal-${leadId}`,
    }),
    sendMail(d.email, partnerConfirmationMail(mailData), {
      category: "transactional",
      template: "partner_lead_confirmation",
      idempotencyKey: `partner-confirmation-${leadId}`,
    }),
  ]);

  await emitTrackingEvent(buildGenerateLeadEvent(`generate_lead_${leadId}`));
  await setSummaryCookie("pv_partner_sent", "/pages/partner", {
    company: d.company,
    businessType: businessLabel,
    email: d.email,
  });
  redirect(PARTNER_SENT_PATH);
}
