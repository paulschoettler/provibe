import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActivationForm } from "@/components/account/ActivationForm";
import { LoginHero } from "@/components/account/LoginHero";
import { Notice } from "@/components/account/ui";
import { SiteShell } from "@/components/layout/SiteShell";
import { getCurrentCustomer } from "@/lib/auth/session";

/**
 * /account/konto-aktivieren: Für Kundinnen und Kunden aus dem alten Shopify-Shop. Passwörter
 * ließen sich nicht übernehmen, deshalb Anmeldung per Aktivierungslink (Briefing 10).
 * Gleicher Aufbau wie der Login (Figma 29:2781).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Konto aktivieren",
  description:
    "Du hattest schon ein Konto im alten provibe Shop? Aktiviere es mit deiner E-Mail-Adresse, deine Bestellungen sind schon da.",
  alternates: { canonical: "/account/konto-aktivieren" },
  robots: { index: false, follow: false },
  openGraph: { title: "Konto aktivieren | provibe", url: "/account/konto-aktivieren" },
};

export default async function ActivatePage() {
  if (await getCurrentCustomer()) redirect("/account");

  return (
    <SiteShell mainClassName="pv-acc pv-acc--login">
      <div className="pv-acc-login">
        <LoginHero
          eyebrow="Willkommen zurück"
          title="Dein Konto ist schon da."
          lead="Wir sind umgezogen. Deine Daten und Bestellungen haben wir mitgenommen."
        />
        <div className="pv-acc-login__card">
          <div className="flex flex-col gap-4">
            <ActivationForm />
            <Notice tone="info" title="Warum muss ich mein Konto aktivieren?">
              Unser Shop läuft jetzt auf eigener Technik. Bestellungen und Adressen aus dem alten
              Shop haben wir übernommen, Passwörter aus Sicherheitsgründen nicht. Nach der Anmeldung
              per Link kannst du in deinen Daten ein neues Passwort setzen oder einfach weiter per
              Magic Link reinkommen.
            </Notice>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
