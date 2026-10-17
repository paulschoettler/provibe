import type { Metadata } from "next";
import { SentPage } from "@/components/content/SentPage";
import { readSummaryCookie } from "@/lib/forms/common";

/** Bestätigung nach der Partneranfrage. Dynamisch (Cookie), nicht indexierbar. */
export const metadata: Metadata = {
  title: "Anfrage gesendet",
  robots: { index: false, follow: false },
  alternates: { canonical: "/pages/partner/gesendet" },
};

export default async function PartnerSentPage() {
  const s = await readSummaryCookie("pv_partner_sent");
  return (
    <SentPage
      eyebrow="Anfrage gesendet"
      title="Danke! Deine Anfrage ist da."
      text={<p className="m-0">Wir melden uns per E-Mail bei dir.</p>}
      summary={
        s
          ? [
              ["Firma", s.company ?? ""],
              ["Art des Geschäfts", s.businessType ?? ""],
              ["E-Mail", s.email ?? ""],
            ]
          : null
      }
      footnote={
        <>
          Fragen in der Zwischenzeit?{" "}
          <a href="mailto:partner@provibe-drinks.de" className="underline">
            partner@provibe-drinks.de
          </a>
        </>
      }
    />
  );
}
