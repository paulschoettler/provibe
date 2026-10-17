import "server-only";
import { cookies } from "next/headers";
import { integrations } from "@/lib/integrations";
import type { SendEmailInput } from "@/lib/integrations/email/types";
import type { MailContent } from "./emails";

/** Gemeinsame Helfer der Formular-Actions (nur Server). */

/** Textfelder aus FormData lesen (fehlende Felder als leere Zeichenkette). */
export function readFields<K extends string>(
  formData: FormData,
  keys: readonly K[],
): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of keys) {
    const v = formData.get(k);
    out[k] = typeof v === "string" ? v : "";
  }
  return out;
}

/** Werte für das Wiederbefüllen nach Fehlern, Honeypot und Längen begrenzt. */
export function echoValues(values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (k === "website") continue;
    out[k] = v.slice(0, 4000);
  }
  return out;
}

/**
 * Mail über den Provider schicken (Mock bis zum Go-live, Allowlist im Resend-Provider).
 * Ein Fehler beim Versand bricht das Formular nicht ab: die Anfrage steht bereits in der
 * Datenbank und ist im Backoffice sichtbar.
 */
export async function sendMail(
  to: string,
  content: MailContent,
  meta: Pick<SendEmailInput, "category" | "template"> & {
    replyTo?: string;
    idempotencyKey?: string;
  },
): Promise<boolean> {
  try {
    const result = await integrations().email.send({
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      category: meta.category,
      template: meta.template,
      replyTo: meta.replyTo,
      idempotencyKey: meta.idempotencyKey,
    });
    return result.status === "sent";
  } catch (error) {
    console.error(`[forms] Mail ${meta.template} an Empfänger fehlgeschlagen`, error);
    return false;
  }
}

/**
 * Kurze Zusammenfassung für die Seite "gesendet" (ohne JavaScript per Redirect erreichbar).
 * httpOnly, nur auf dem jeweiligen Pfad, zehn Minuten gültig. Keine Daten in der URL.
 */
export async function setSummaryCookie(name: string, path: string, data: Record<string, string>) {
  const store = await cookies();
  store.set(name, JSON.stringify(data), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path,
    maxAge: 600,
  });
}

export async function readSummaryCookie(name: string): Promise<Record<string, string> | null> {
  const store = await cookies();
  const raw = store.get(name)?.value;
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v.slice(0, 300);
    }
    return out;
  } catch {
    return null;
  }
}

/** Testeinträge erkennen (Vorgabe: test-*@provibe-drinks.de), damit sie gezielt löschbar bleiben. */
export function isTestAddress(email: string): boolean {
  return /^test-[^@]*@provibe-drinks\.de$/i.test(email);
}
