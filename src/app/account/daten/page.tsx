import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AccountShell } from "@/components/account/AccountShell";
import {
  DeleteAccountForm,
  EmailForm,
  NewsletterForm,
  PasswordForm,
  ProfileForm,
} from "@/components/account/DataForms";
import { BTN_OUTLINE, CARD_FLAT, Notice } from "@/components/account/ui";
import { signOutEverywhere } from "@/lib/auth/actions";
import { getNewsletterState } from "@/lib/auth/account-data";
import { requireCustomer } from "@/lib/auth/session";

/**
 * /account/daten: Name, E-Mail, Passwort, Newsletter, Abmelden überall, Konto löschen.
 * Abgeleitet aus den Konto-Vorlagen (kein eigener Figma-Screen laut Seitenplan).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deine Daten",
  description: "Name, E-Mail-Adresse, Passwort und Newsletter in deinem provibe Konto.",
  alternates: { canonical: "/account/daten" },
  robots: { index: false, follow: false },
};

function Section({
  id,
  title,
  children,
  tone,
}: {
  id: string;
  title: string;
  children: ReactNode;
  tone?: "danger";
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titel`}
      className={`${CARD_FLAT} scroll-mt-28 p-5 sm:p-6 ${tone === "danger" ? "border-pv-wildberry border-[1.5px]" : ""}`}
    >
      <h2 id={`${id}-titel`} className="mb-4 text-[20px] leading-[1.2] font-medium">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<{ passwort?: string; email?: string }>;
}) {
  const customer = await requireCustomer("/account/daten");
  const [params, newsletter] = await Promise.all([searchParams, getNewsletterState(customer)]);

  return (
    <AccountShell active="daten">
      <h1 className="headline text-pv-wildberry text-[40px] lg:text-[56px]">Deine Daten</h1>

      {params.email === "bestaetigt" ? (
        <Notice tone="success" role="status" title="E-Mail-Adresse bestätigt" className="mt-5">
          Ab jetzt meldest du dich mit {customer.email} an.
        </Notice>
      ) : null}
      {params.email === "halb" ? (
        <Notice tone="info" role="status" title="Eine Bestätigung fehlt noch" className="mt-5">
          Bitte bestätige den Wechsel auch über den Link in deinem anderen Postfach.
        </Notice>
      ) : null}

      <div className="mt-6 flex flex-col gap-4">
        <Section id="profil" title="Name und Telefon">
          <ProfileForm
            firstName={customer.firstName ?? ""}
            lastName={customer.lastName ?? ""}
            phone={customer.phone ?? ""}
          />
        </Section>

        <Section id="email" title="E-Mail-Adresse">
          <EmailForm current={customer.email} pending={customer.pendingEmail} />
        </Section>

        <Section id="passwort" title="Passwort">
          <p className="mb-4 text-[15px] leading-[1.5]">
            Ein Passwort ist freiwillig. Ohne Passwort meldest du dich einfach per Magic Link an.
          </p>
          <PasswordForm recovery={params.passwort === "neu"} />
        </Section>

        <Section id="newsletter" title="Newsletter">
          <NewsletterForm state={newsletter} />
        </Section>

        <Section id="geraete" title="Angemeldete Geräte">
          <p className="mb-4 text-[15px] leading-[1.5]">
            Du hast dich auf einem fremden Gerät angemeldet oder vermutest, dass jemand anderes
            Zugriff hat? Dann melde dich überall ab.
          </p>
          <form action={signOutEverywhere}>
            <button type="submit" className={BTN_OUTLINE}>
              Auf allen Geräten abmelden
            </button>
          </form>
        </Section>

        <Section id="loeschen" title="Konto löschen" tone="danger">
          <DeleteAccountForm />
        </Section>
      </div>
    </AccountShell>
  );
}
