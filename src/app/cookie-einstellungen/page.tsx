import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ConsentForm } from "@/components/consent/ConsentForm";
import { Eyebrow, PageBand } from "@/components/catalog/parts";
import { SiteShell } from "@/components/layout/SiteShell";
import {
  CONSENT_COOKIE,
  isCurrentConsent,
  parseConsent,
  type ConsentState,
} from "@/lib/tracking/consent";
import { getTrackingConfig } from "@/lib/tracking/settings";
import { VENDOR_INFO } from "@/lib/tracking/vendors";

/**
 * Cookie-Einstellungen als eigene Seite (Ziel des Footer-Links ohne JavaScript, Widerruf jederzeit,
 * Briefing 5). Vollständig im Server-HTML, das Formular speichert ohne JavaScript per Server Action
 * und leitet mit ?gespeichert=1 zurück. Dynamisch, weil der aktuelle Stand aus dem Cookie kommt.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cookie-Einstellungen",
  description:
    "Deine Cookie-Wahl bei provibe: notwendige Cookies, Statistik und Marketing mit Meta, Google und TikTok. Jederzeit änderbar und widerrufbar.",
  alternates: { canonical: "/cookie-einstellungen" },
  robots: { index: false, follow: true },
};

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

function statusText(consent: ConsentState | null): string {
  if (!isCurrentConsent(consent))
    return "Du hast noch keine Auswahl getroffen. Bis dahin laufen nur notwendige Cookies.";
  const when = dateFormat.format(new Date(consent.ts * 1000));
  if (!consent.vendors.length) return `Gespeichert am ${when}: nur notwendige Cookies.`;
  const names = consent.vendors.map((v) => VENDOR_INFO[v].name).join(", ");
  return `Gespeichert am ${when}: notwendige Cookies und Marketing (${names}).`;
}

export default async function CookieSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gespeichert?: string }>;
}) {
  const [store, params, config] = await Promise.all([cookies(), searchParams, getTrackingConfig()]);
  const consent = parseConsent(store.get(CONSENT_COOKIE)?.value);
  const current = isCurrentConsent(consent) ? consent.vendors : [];

  return (
    <SiteShell>
      <PageBand innerClassName="max-w-[760px]">
        <Eyebrow>Datenschutz</Eyebrow>
        <h1 className="pv-consent-page-title">Cookie-Einstellungen</h1>
        <p className="pv-consent-page-lead">
          Du entscheidest, was wir nutzen dürfen. Ohne dein Okay bleibt Marketing aus. Deine Wahl
          kannst du hier jederzeit ändern oder widerrufen; der Widerruf gilt ab sofort.
        </p>
      </PageBand>

      <div className="mx-auto w-full max-w-[760px] px-4 pb-16 sm:px-6 lg:pb-24">
        {params.gespeichert ? (
          <p className="pv-consent-notice" role="status">
            Gespeichert. Deine Auswahl gilt ab sofort.
          </p>
        ) : null}
        <p className="pv-consent-current">
          <strong>Dein aktueller Stand:</strong> {statusText(consent)}
        </p>
        <ConsentForm
          idPrefix="pv-cp"
          variant="page"
          initialVendors={current}
          activeVendors={{
            meta: Boolean(config.meta),
            google: Boolean(config.google),
            tiktok: Boolean(config.tiktok),
          }}
          returnTo="/cookie-einstellungen"
          vendorsOpen
        />
        <p className="pv-consent-page-foot">
          Jede Entscheidung speichern wir als Nachweis mit Zeitpunkt, Version dieses Textes, deiner
          Auswahl, einer zufälligen Kennung, einem nicht umkehrbaren Hash deiner IP-Adresse und
          einer gekürzten Browserkennung. Mehr dazu im Abschnitt „Cookies, Einwilligung und
          Tracking“ der Datenschutzerklärung.
        </p>
      </div>
    </SiteShell>
  );
}
