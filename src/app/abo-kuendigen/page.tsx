import type { Metadata } from "next";
import { Eyebrow } from "@/components/content/Decor";
import { SiteShell } from "@/components/layout/SiteShell";
import { GoodToKnow } from "@/components/subscriptions/GoodToKnow";
import { PublicCancelForm } from "@/components/subscriptions/PublicCancelForm";
import { berlinDay } from "@/lib/subscriptions/schedule";

/**
 * Kündigung ohne Login nach § 312k BGB (Figma 71:1592 mobil, 71:2162 Desktop), dauerhaft
 * erreichbar über den Footer-Link "Vertrag kündigen". Statisch, das Formular arbeitet über eine
 * Server Action; der Klick "Jetzt kündigen" erklärt die Kündigung sofort (H23).
 */
export const revalidate = 3600;

const DESCRIPTION =
  "Abo kündigen ohne Login: Name und E-Mail eintragen, auf „Jetzt kündigen“ tippen, fertig. Du bekommst sofort eine Bestätigung mit Datum und Uhrzeit.";

export const metadata: Metadata = {
  title: "Abo kündigen",
  description: DESCRIPTION,
  alternates: { canonical: "/abo-kuendigen" },
  openGraph: { title: "Abo kündigen | provibe", description: DESCRIPTION, url: "/abo-kuendigen" },
};

export default function AboKuendigenPage() {
  return (
    <SiteShell mainClassName="pv-abo-cancel">
      <div className="pv-abo-cancel__blob" aria-hidden="true" />
      <div className="pv-container pv-before-footer relative grid gap-8 pt-8 pb-16 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16 lg:pt-14">
        <div className="min-w-0">
          <Eyebrow>Vertrag kündigen</Eyebrow>
          <h1 className="headline text-pv-wildberry mt-3 text-[44px] leading-[1.05] lg:text-[64px]">
            Abo kündigen
          </h1>
          <p className="mt-4 mb-6 text-[16px] leading-[1.55] lg:text-[17px]">
            Hier kündigst du dein PROVIBE-Abo, auch ohne Login. Füll die Felder aus und tipp auf
            „Jetzt kündigen“.
          </p>
          <PublicCancelForm today={berlinDay(new Date())} />
        </div>
        <div className="lg:pt-[120px]">
          <GoodToKnow />
        </div>
      </div>
    </SiteShell>
  );
}
