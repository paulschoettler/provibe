import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { LoginCard, type LoginTab } from "@/components/account/LoginCard";
import { LoginHero } from "@/components/account/LoginHero";
import { Notice } from "@/components/account/ui";
import { SiteShell } from "@/components/layout/SiteShell";
import { safeNextPath } from "@/lib/auth/redirect";
import { getCurrentCustomer } from "@/lib/auth/session";

/**
 * /account/login (Figma 29:2781, 29:2905, 29:3039, 29:3160). Dynamisch, weil die Session
 * geprüft wird: Wer schon eingeloggt ist, landet direkt am Ziel.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Anmelden",
  description:
    "Melde dich in deinem provibe Konto an: Bestellungen, Rechnungen und Lieferstatus an einem Ort.",
  alternates: { canonical: "/account/login" },
  robots: { index: false, follow: false },
  openGraph: { title: "Anmelden | provibe", url: "/account/login" },
};

const TABS: LoginTab[] = ["magic", "passwort", "registrieren", "vergessen"];

const MESSAGES: Record<
  string,
  { tone: "info" | "error" | "success"; title: string; text: string }
> = {
  link: {
    tone: "error",
    title: "Der Link hat nicht funktioniert",
    text: "Er ist abgelaufen oder wurde schon benutzt. Fordere einfach einen neuen an.",
  },
  browser: {
    tone: "error",
    title: "Bitte im selben Browser öffnen",
    text: "Öffne den Link im Browser, in dem du ihn angefordert hast, oder fordere hier einen neuen an.",
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    next?: string;
    fehler?: string;
    abgemeldet?: string;
    geloescht?: string;
  }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const customer = await getCurrentCustomer();
  if (customer) redirect(next as Route);

  const tab: LoginTab = TABS.includes(params.tab as LoginTab) ? (params.tab as LoginTab) : "magic";
  const error = params.fehler ? (MESSAGES[params.fehler] ?? MESSAGES.link) : null;

  return (
    <SiteShell mainClassName="pv-acc pv-acc--login">
      <div className="pv-acc-login">
        <LoginHero
          title="Dein Vibe, deine Bestellungen."
          lead="Bestellungen, Rechnungen und Lieferstatus an einem Ort."
        />
        <div className="pv-acc-login__card">
          <div className="flex flex-col gap-4">
            {error ? (
              <Notice tone={error.tone} role="alert" title={error.title}>
                {error.text}
              </Notice>
            ) : null}
            {params.abgemeldet ? (
              <Notice tone="success" role="status" title="Du bist abgemeldet">
                Bis bald! Dein Warenkorb bleibt in deinem Konto gespeichert.
              </Notice>
            ) : null}
            {params.geloescht ? (
              <Notice tone="success" role="status" title="Dein Konto ist gelöscht">
                Wir haben dir eine Bestätigung per E-Mail geschickt. Bestellungen bewahren wir nur
                so lange auf, wie das Gesetz es verlangt.
              </Notice>
            ) : null}
            <LoginCard tab={tab} next={next} />
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
