import { LegalDocumentPage, legalMetadata } from "@/components/content/LegalPage";

/** Versand und Zahlung aus legal_documents (kind versand). Ziel des Hinweises "zzgl. Versand". */
export const revalidate = 3600;

export function generateMetadata() {
  return legalMetadata("versand");
}

export default function VersandPage() {
  return <LegalDocumentPage kind="versand" />;
}
