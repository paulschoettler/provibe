import type { Metadata } from "next";
import { SentPage } from "@/components/content/SentPage";
import { Notice } from "@/components/forms";
import { formatDateDe } from "@/lib/content/format";
import { getShopSettings, returnAddress } from "@/lib/content/settings";
import { readSummaryCookie } from "@/lib/forms/common";

/** Bestätigung nach dem Widerruf. Dynamisch (Cookie), nicht indexierbar. */
export const metadata: Metadata = {
  title: "Widerruf eingegangen",
  robots: { index: false, follow: false },
  alternates: { canonical: "/pages/widerruf-formular/gesendet" },
};

export default async function WithdrawalSentPage() {
  const [s, settings] = await Promise.all([
    readSummaryCookie("pv_withdrawal_sent"),
    getShopSettings(),
  ]);
  return (
    <SentPage
      tone="berry"
      eyebrow="Widerruf eingegangen"
      title="Dein Widerruf ist bei uns."
      text={
        <p className="m-0">
          Wir haben dir eine Eingangsbestätigung per E-Mail geschickt. Bitte heb sie auf.
        </p>
      }
      summaryTitle="Dein Widerruf"
      summary={
        s
          ? [
              ["Bestellnummer", s.orderNumber ?? ""],
              ["E-Mail", s.email ?? ""],
              ["Eingegangen am", s.receivedAt ? formatDateDe(s.receivedAt) : ""],
            ]
          : null
      }
      footnote={
        <>
          Fragen?{" "}
          <a href={`mailto:${settings.contact.supportEmail}`} className="underline">
            {settings.contact.supportEmail}
          </a>
        </>
      }
    >
      <Notice title="So geht es weiter" className="w-full">
        <p>
          Schick die Ware bitte spätestens 14 Tage nach deinem Widerruf an{" "}
          {returnAddress(settings.legalEntity)}. Die unmittelbaren Kosten der Rücksendung trägst du.
        </p>
      </Notice>
    </SentPage>
  );
}
