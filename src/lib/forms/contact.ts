"use server";

import { redirect } from "next/navigation";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { echoValues, readFields, sendMail, setSummaryCookie } from "./common";
import { contactConfirmationMail, contactInternalMail } from "./emails";
import { CONTACT_SUBJECTS, contactSchema, fieldErrors, labelFor } from "./schemas";
import { FORM_ERROR_TEXT, FORM_FAILURE_TEXT, type FormState } from "./state";

const FIELDS = ["name", "email", "subject", "message", "website"] as const;
const SENT_PATH = "/pages/contact/gesendet";

type InsertResult = { id: string } | null;

/**
 * contact_messages.subject entsteht mit Migration 20261017102000. Bis sie auf der
 * Live-Instanz angewendet ist, landet der Betreff als erste Zeile in der Nachricht.
 */
async function insertMessage(row: {
  name: string;
  email: string;
  subject: string;
  message: string;
  ip_hash: string;
}): Promise<InsertResult> {
  const db = supabaseAdmin();
  // Spalte subject fehlt noch in den generierten Typen (Vorschlag: Typen neu erzeugen)
  const withSubject = row as unknown as {
    name: string;
    email: string;
    message: string;
    ip_hash: string;
  };
  const first = await db.from("contact_messages").insert(withSubject).select("id").single();
  if (!first.error) return first.data;
  const missingColumn =
    first.error.code === "PGRST204" || /subject/i.test(first.error.message ?? "");
  if (!missingColumn) throw first.error;
  const second = await db
    .from("contact_messages")
    .insert({
      name: row.name,
      email: row.email,
      message: `Betreff: ${row.subject}\n\n${row.message}`,
      ip_hash: row.ip_hash,
    })
    .select("id")
    .single();
  if (second.error) throw second.error;
  return second.data;
}

/**
 * Kontaktformular: Zod, Honeypot, Rate Limit, contact_messages (Service-Role, anon darf
 * nicht schreiben), Mail an hello@ mit Reply-To auf den Absender, Bestätigung an den Absender.
 */
export async function submitContactForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readFields(formData, FIELDS);
  // Honeypot gefüllt: still beenden, für Bots sieht es nach Erfolg aus (kein Eintrag, keine Mail)
  if (raw.website) redirect(SENT_PATH);
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: FORM_ERROR_TEXT,
      fieldErrors: fieldErrors(parsed.error),
      values: echoValues(raw),
    };
  }
  const d = parsed.data;

  const limit = await checkRateLimit({ action: "contact", limit: 5, windowSeconds: 3600 });
  if (!limit.allowed) {
    return { status: "error", message: RATE_LIMIT_MESSAGE, values: echoValues(raw) };
  }

  const subjectLabel = labelFor(CONTACT_SUBJECTS, d.subject);
  let messageId: string;
  try {
    const row = await insertMessage({
      name: d.name,
      email: d.email,
      subject: subjectLabel,
      message: d.message,
      ip_hash: limit.ipHash,
    });
    if (!row) throw new Error("Kein Datensatz zurückgegeben");
    messageId = row.id;
  } catch (error) {
    console.error("[forms] Kontaktnachricht konnte nicht gespeichert werden", error);
    return { status: "error", message: FORM_FAILURE_TEXT, values: echoValues(raw) };
  }

  const mailData = { name: d.name, email: d.email, subject: subjectLabel, message: d.message };
  await Promise.all([
    sendMail("hello@provibe-drinks.de", contactInternalMail(mailData, messageId), {
      category: "internal",
      template: "contact_internal",
      replyTo: d.email,
      idempotencyKey: `contact-internal-${messageId}`,
    }),
    sendMail(d.email, contactConfirmationMail(mailData), {
      category: "transactional",
      template: "contact_confirmation",
      idempotencyKey: `contact-confirmation-${messageId}`,
    }),
  ]);

  await setSummaryCookie("pv_contact_sent", "/pages/contact", {
    name: d.name,
    subject: subjectLabel,
  });
  redirect(SENT_PATH);
}
