"use server";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkRateLimit, currentIpHash } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  CONSENT_VERSION,
  MARKETING_VENDORS,
  consentAction,
  consentCategories,
  consentIdFromBytes,
  decideConsent,
  parseConsent,
  serializeConsent,
  type ConsentAction,
  type ConsentState,
} from "./consent";
import { sanitizePath } from "./paths";

/**
 * Speichern der Cookie-Wahl mit Nachweis in consent_logs (Briefing 5, Legal-Checkliste 5.2).
 *
 * saveConsentForm: Formularweg ohne JavaScript (Banner, Dialog, /cookie-einstellungen). Setzt den
 *   Cookie, protokolliert und leitet zurück.
 * logConsent: Weg mit JavaScript. Der Browser hat den Cookie schon gesetzt (sofortige Wirkung);
 *   der Server setzt ihn noch einmal per Set-Cookie (volle Laufzeit auch in Safari, das per Skript
 *   gesetzte Cookies kürzt) und protokolliert.
 *
 * Protokolliert werden Zeitpunkt (created_at), Textversion, Auswahl, Kennung, IP-Hash
 * (gesalzen, gekürzt), User-Agent gekürzt auf 120 Zeichen und der bereinigte Pfad.
 */

const choiceSchema = z.enum(["alle", "notwendig", "auswahl"]);

async function setConsentCookie(state: ConsentState) {
  const store = await cookies();
  store.set(CONSENT_COOKIE, serializeConsent(state), {
    path: "/",
    maxAge: CONSENT_MAX_AGE_SECONDS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  });
}

async function writeLog(state: ConsentState, action: ConsentAction, pagePath: string) {
  const limit = await checkRateLimit({ action: "consent", limit: 60, windowSeconds: 3600 });
  if (!limit.allowed) return;
  const h = await headers();
  const { error } = await supabaseAdmin()
    .from("consent_logs")
    .insert({
      anonymous_id: state.id,
      action,
      categories: consentCategories(state),
      banner_version: state.version,
      ip_hash: limit.ipHash || (await currentIpHash()),
      user_agent: (h.get("user-agent") ?? "").slice(0, 120) || null,
      page_url: sanitizePath(pagePath).slice(0, 200),
    });
  if (error) console.error("[consent] Protokoll nicht gespeichert", error.message);
}

/** Nur relative, eigene Pfade als Ziel der Weiterleitung. */
function safeReturnPath(candidate: string | null | undefined): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return "/";
  if (candidate.includes("\\")) return "/";
  return candidate.slice(0, 300);
}

async function returnPathFromReferer(): Promise<string> {
  const h = await headers();
  const referer = h.get("referer");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!referer || !host) return "/";
  try {
    const url = new URL(referer);
    if (url.host !== host) return "/";
    return safeReturnPath(`${url.pathname}${url.search}`);
  } catch {
    return "/";
  }
}

export async function saveConsentForm(formData: FormData): Promise<void> {
  const choice = choiceSchema.safeParse(formData.get("wahl"));
  const store = await cookies();
  const previous = parseConsent(store.get(CONSENT_COOKIE)?.value);

  let selected = formData.getAll("vendor").map(String);
  // Hauptschalter Marketing an, aber kein Anbieter gewählt: dann gilt Marketing für alle Anbieter
  if (
    choice.success &&
    choice.data === "auswahl" &&
    formData.get("marketing") &&
    !selected.length
  ) {
    selected = [...MARKETING_VENDORS];
  }
  const next = decideConsent(choice.success ? choice.data : "notwendig", selected, previous, {
    id: consentIdFromBytes(randomBytes(20)),
    now: Date.now(),
  });

  const field = String(formData.get("zurueck") ?? "");
  const target = field ? safeReturnPath(field) : await returnPathFromReferer();
  const action = consentAction(previous, next);
  await setConsentCookie(next);
  try {
    await writeLog(next, action, target.split("?")[0]);
  } catch (error) {
    console.error("[consent] Protokoll fehlgeschlagen", error);
  }

  const onSettingsPage = target.startsWith("/cookie-einstellungen");
  redirect(onSettingsPage ? "/cookie-einstellungen?gespeichert=1" : target);
}

const logSchema = z.object({
  value: z.string().max(120),
  previous: z.string().max(120).nullable(),
  page: z.string().max(300),
});

export async function logConsent(input: {
  value: string;
  previous: string | null;
  page: string;
}): Promise<{ ok: boolean }> {
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const next = parseConsent(parsed.data.value);
  // Nur die aktuelle Textversion und ein frischer Zeitpunkt (höchstens 10 Minuten alt) zählen
  if (!next || next.version !== CONSENT_VERSION) return { ok: false };
  if (Math.abs(Date.now() / 1000 - next.ts) > 600) return { ok: false };
  const previous = parseConsent(parsed.data.previous);
  try {
    await setConsentCookie(next);
    await writeLog(next, consentAction(previous, next), safeReturnPath(parsed.data.page));
    return { ok: true };
  } catch (error) {
    console.error("[consent] Protokoll fehlgeschlagen", error);
    return { ok: false };
  }
}
