import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/content/Breadcrumbs";
import { Blob, Eyebrow, InhaltIcon } from "@/components/content/Decor";
import { WithdrawalForm } from "@/components/content/WithdrawalForm";
import { Notice } from "@/components/forms";
import { SiteLink } from "@/components/layout/SiteLink";
import { SiteShell } from "@/components/layout/SiteShell";
import { getShopSettings } from "@/lib/content/settings";

/**
 * Elektronische Widerrufsfunktion "Vertrag widerrufen" (Briefing 5, dauerhaft erreichbar,
 * Footer-Link). Ersetzt die Shopify-App "EU Widerrufsbutton". Statisch, das Formular
 * arbeitet über eine Server Action.
 */
export const revalidate = 3600;

const DESCRIPTION =
  "Vertrag widerrufen: Erklär deinen Widerruf online und bekomm sofort eine Eingangsbestätigung per E-Mail. Die Widerrufsfrist beträgt 14 Tage ab Erhalt der Ware.";

export const metadata: Metadata = {
  title: "Vertrag widerrufen",
  description: DESCRIPTION,
  alternates: { canonical: "/pages/widerruf-formular" },
  openGraph: {
    title: "Vertrag widerrufen | provibe",
    description: DESCRIPTION,
    url: "/pages/widerruf-formular",
  },
};

export default async function WiderrufFormularPage() {
  const { legalEntity, contact } = await getShopSettings();
  return (
    <SiteShell>
      <header className="pv-legal-head">
        <Blob
          name="hero-2"
          className="top-[-60px] right-[-90px] w-[260px] opacity-60 lg:right-[-60px] lg:w-[340px]"
        />
        <div className="pv-container relative z-[1]">
          <Breadcrumbs items={[{ name: "Vertrag widerrufen", path: "/pages/widerruf-formular" }]} />
          <Eyebrow className="mt-4">Widerruf</Eyebrow>
          <h1>Vertrag widerrufen</h1>
          <p className="pv-lead !text-[17px] lg:max-w-[620px] lg:!text-[19px]">
            Füll das Formular aus, um deinen Widerruf zu erklären. Du bekommst sofort eine
            Eingangsbestätigung per E-Mail.
          </p>
        </div>
      </header>

      <div className="pv-container pv-before-footer grid gap-6 pt-4 lg:grid-cols-[1.75fr_1fr] lg:gap-8 lg:pt-6">
        <div className="order-2 lg:order-1">
          <WithdrawalForm />
        </div>
        <aside
          className="order-1 flex flex-col gap-4 lg:order-2 lg:self-start"
          aria-label="Frist und Rücksendung"
        >
          <Notice title="Frist und Rücksendung">
            <p>
              Die Widerrufsfrist beträgt 14 Tage ab Erhalt der Ware. Es reicht, wenn du den Widerruf
              vor Ablauf der Frist absendest. Schick die Ware bitte spätestens 14 Tage nach deinem
              Widerruf zurück, die unmittelbaren Kosten der Rücksendung trägst du.
            </p>
          </Notice>
          <section
            className="bg-pv-cream flex flex-col gap-3 rounded-[16px] px-5 py-5"
            aria-labelledby="ruecksendung-titel"
          >
            <h2 id="ruecksendung-titel" className="text-pv-wildberry m-0 text-[20px] font-medium">
              Rücksendung
            </h2>
            <address className="text-[15px] leading-[1.55] not-italic">
              {legalEntity.name}
              <br />
              {legalEntity.street}
              <br />
              {legalEntity.zip} {legalEntity.city}
            </address>
            <p className="m-0 text-[14px] leading-[1.5]">
              Die Adresse steht auch in deiner Eingangsbestätigung und in der Widerrufsbelehrung.
            </p>
            <SiteLink href="/pages/ruckgabe-und-wiederrufsbelehrung" className="pv-textlink">
              Zur Widerrufsbelehrung
              <InhaltIcon name="arrow" size={18} />
            </SiteLink>
            <div className="pv-channel">
              <span className="pv-icon-circle" aria-hidden="true">
                <InhaltIcon name="mail" />
              </span>
              <span className="min-w-0">
                <span className="pv-channel-label">Lieber per E-Mail?</span>
                <a href={`mailto:${contact.supportEmail}`} className="pv-channel-value">
                  {contact.supportEmail}
                </a>
              </span>
            </div>
          </section>
        </aside>
      </div>
    </SiteShell>
  );
}
