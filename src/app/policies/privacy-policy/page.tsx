import { LegalDocumentPage, legalMetadata } from "@/components/content/LegalPage";

/** Datenschutzerklärung aus legal_documents (kind datenschutz), alter Shopify-Pfad bleibt erhalten. */
export const revalidate = 3600;

export function generateMetadata() {
  return legalMetadata("datenschutz");
}

export default function PrivacyPolicyPage() {
  return <LegalDocumentPage kind="datenschutz" />;
}
