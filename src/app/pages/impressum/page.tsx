import { LegalDocumentPage, legalMetadata } from "@/components/content/LegalPage";
import { getShopSettings } from "@/lib/content/settings";

/**
 * Impressum aus legal_documents (kind impressum). Die LUCID-Registrierungsnummer
 * (Verpackungsgesetz) kommt aus shop_settings; solange sie fehlt, steht ein Platzhalter (H8, B13).
 */
export const revalidate = 3600;

export function generateMetadata() {
  return legalMetadata("impressum");
}

export default async function ImpressumPage() {
  const { legalEntity } = await getShopSettings();
  const lucid = legalEntity.lucidNumber;
  return (
    <LegalDocumentPage
      kind="impressum"
      compact
      extra={[
        {
          id: "verpackungsregister",
          heading: "Verpackungsregister",
          content: (
            <p>
              Registrierungsnummer im Verpackungsregister LUCID:{" "}
              {lucid ? lucid : <span data-platzhalter="lucid">Registrierungsnummer folgt</span>}
            </p>
          ),
        },
      ]}
    />
  );
}
