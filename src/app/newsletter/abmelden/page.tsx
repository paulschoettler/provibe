import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Select } from "@/components/forms";
import { lookupUnsubscribeToken } from "@/lib/admin/newsletter/unsubscribe";
import { confirmUnsubscribe } from "./actions";
import { UNSUBSCRIBE_REASONS } from "./reasons";

export const metadata: Metadata = {
  title: "Newsletter abmelden",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Abmeldeseite aus dem Link jeder Werbemail (/newsletter/abmelden?token=...&c=<Kampagne>).
 * Alles im Server-HTML; das Formular sendet ohne JavaScript an die Server Action.
 * Der Aufruf allein meldet nicht ab (Link-Vorschau in Mailprogrammen), erst der Button.
 */
export default async function NewsletterUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; c?: string; ergebnis?: string }>;
}) {
  const params = await searchParams;
  const token = params.token?.trim() ?? "";
  const lookup = token ? await lookupUnsubscribeToken(token) : { valid: false as const };
  const done = params.ergebnis === "abgemeldet" || (lookup.valid && lookup.alreadyUnsubscribed);
  const failed = params.ergebnis === "fehler";

  return (
    <>
      <Header variant="default" />
      <main className="pv-confirm">
        <div className="pv-confirm-card">
          <p className="eyebrow">Newsletter</p>
          {!lookup.valid ? (
            <>
              <h1 className="headline pv-confirm-title">Der Abmeldelink ist ungültig.</h1>
              <p className="pv-confirm-text">
                Nutze bitte den Link aus einer aktuellen E-Mail von uns oder schreib an{" "}
                <a href="mailto:hello@provibe-drinks.de">hello@provibe-drinks.de</a>, dann melden
                wir dich ab.
              </p>
            </>
          ) : done ? (
            <>
              <h1 className="headline pv-confirm-title">Du bist abgemeldet.</h1>
              <p className="pv-confirm-text">
                {lookup.maskedEmail} bekommt keinen Newsletter mehr von uns. Bestellbestätigungen
                und andere Mails zu deinen Bestellungen schicken wir dir weiterhin.
              </p>
            </>
          ) : (
            <>
              <h1 className="headline pv-confirm-title">Newsletter abmelden?</h1>
              <p className="pv-confirm-text">
                Wir melden {lookup.maskedEmail} vom provibe Newsletter ab. Danach bekommst du keine
                Werbung mehr von uns.
              </p>
              {failed ? (
                <p className="pv-confirm-text" role="alert">
                  Das hat gerade nicht geklappt. Bitte versuch es noch einmal.
                </p>
              ) : null}
              <form action={confirmUnsubscribe} className="pv-unsubscribe-form">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="campaign" value={params.c ?? ""} />
                <Select
                  name="reason"
                  label="Magst du uns sagen, warum?"
                  optional
                  placeholder="Keine Angabe"
                  options={UNSUBSCRIBE_REASONS.map((r) => ({ value: r.value, label: r.label }))}
                />
                <button type="submit" className="btn-primary pv-confirm-button">
                  Jetzt abmelden
                </button>
              </form>
            </>
          )}
          <p className="pv-confirm-text">
            <Link href="/">Zur Startseite</Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
