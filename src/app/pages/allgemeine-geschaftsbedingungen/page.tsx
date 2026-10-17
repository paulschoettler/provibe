import { LegalDocumentPage, legalMetadata } from "@/components/content/LegalPage";

/** AGB aus legal_documents (kind agb), höchste veröffentlichte Version. */
export const revalidate = 3600;

export function generateMetadata() {
  return legalMetadata("agb");
}

export default function AgbPage() {
  return <LegalDocumentPage kind="agb" />;
}
