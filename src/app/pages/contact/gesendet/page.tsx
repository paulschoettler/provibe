import type { Metadata } from "next";
import { SentPage } from "@/components/content/SentPage";
import { Notice } from "@/components/forms";
import { readSummaryCookie } from "@/lib/forms/common";

/** Bestätigung nach dem Kontaktformular. Dynamisch (Cookie), nicht indexierbar. */
export const metadata: Metadata = {
  title: "Nachricht gesendet",
  robots: { index: false, follow: false },
  alternates: { canonical: "/pages/contact/gesendet" },
};

export default async function ContactSentPage() {
  const s = await readSummaryCookie("pv_contact_sent");
  return (
    <SentPage
      tone="berry"
      eyebrow="Nachricht gesendet"
      title={s?.name ? `Danke, ${s.name}!` : "Danke für deine Nachricht!"}
      text={<p className="m-0">Wir haben dir eine Bestätigung per E-Mail geschickt.</p>}
      summaryTitle="Deine Nachricht"
      summary={s?.subject ? [["Betreff", s.subject]] : null}
      footnote={
        <>
          Eilig?{" "}
          <a href="mailto:hello@provibe-drinks.de" className="underline">
            hello@provibe-drinks.de
          </a>
        </>
      }
    >
      <Notice variant="success" title="Danke, das hat geklappt." className="w-full">
        <p>Wir haben deine Nachricht erhalten und melden uns innerhalb von 24 Stunden.</p>
      </Notice>
    </SentPage>
  );
}
