import { SiteLink } from "@/components/layout/SiteLink";
import { Notice } from "@/components/forms";
import { LegalDocumentPage, legalMetadata } from "@/components/content/LegalPage";

/** Widerrufsbelehrung aus legal_documents (kind widerruf) mit Einstieg in die elektronische Widerrufsfunktion. */
export const revalidate = 3600;

export function generateMetadata() {
  return legalMetadata("widerruf");
}

export default function WiderrufsbelehrungPage() {
  return (
    <LegalDocumentPage
      kind="widerruf"
      before={
        <Notice
          title="Du willst widerrufen?"
          action={
            <SiteLink href="/pages/widerruf-formular" className="pv-btn-primary">
              Vertrag widerrufen
            </SiteLink>
          }
        >
          <p>
            Mit unserem Online-Formular geht es am schnellsten. Du bekommst sofort eine
            Eingangsbestätigung per E-Mail.
          </p>
        </Notice>
      }
    />
  );
}
