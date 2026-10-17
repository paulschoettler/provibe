import type { Metadata } from "next";
import { SentPage } from "@/components/content/SentPage";
import { Notice } from "@/components/forms";
import { AUTHENTICITY_TEXT } from "@/components/reviews/AuthenticityNote";

/**
 * Dankesseite nach dem Bewerten (statisch, nicht indexierbar). Ohne Daten aus der URL oder aus
 * Cookies, damit sie aus dem Build ausgeliefert werden kann.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Danke für deine Bewertung",
  robots: { index: false, follow: false },
  alternates: { canonical: "/bewerten/danke" },
};

export default function ReviewThanksPage() {
  return (
    <SentPage
      tone="berry"
      eyebrow="Bewertung gesendet"
      title="Danke für deine Bewertung!"
      text={
        <p className="m-0">
          Wir lesen jede Bewertung, bevor sie online geht. Sobald wir sie freigegeben haben,
          erscheint sie auf der Produktseite.
        </p>
      }
      footnote={
        <>
          Etwas vertippt? Über den Link in deiner Mail kannst du deine Bewertung bis zu 60 Tage lang
          ändern.
        </>
      }
    >
      <Notice variant="success" title="Gespeichert und in Prüfung." className="w-full">
        <p>{AUTHENTICITY_TEXT}</p>
      </Notice>
    </SentPage>
  );
}
