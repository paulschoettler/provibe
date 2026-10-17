import type { Metadata, Route } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/content/Decor";
import { SiteShell } from "@/components/layout/SiteShell";
import { GoodToKnow } from "@/components/subscriptions/GoodToKnow";
import { readCancellationSummary } from "@/lib/subscriptions/cancel-summary";
import { formatDay, formatDayTime } from "@/lib/subscriptions/schedule";

/**
 * Bestätigung der Kündigung ohne Login (Figma 71:1984 mobil, 71:2602 Desktop). Zeigt die
 * abgegebene Erklärung mit Datum und Uhrzeit, nie, ob zu den Angaben ein Abo existiert.
 * Dynamisch (httpOnly-Cookie mit der Zusammenfassung), nicht indexierbar.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kündigung eingegangen",
  robots: { index: false, follow: false },
  alternates: { canonical: "/abo-kuendigen/bestaetigt" },
};

export default async function KuendigungBestaetigtPage() {
  const s = await readCancellationSummary();
  const rows: [string, string][] = s
    ? [
        ["Name", s.name ?? ""],
        ["E-Mail", s.email ?? ""],
        ["Abo-Nummer", s.number || "nicht angegeben"],
        [
          "Art der Kündigung",
          s.kind === "extraordinary" ? "Außerordentliche Kündigung" : "Ordentliche Kündigung",
        ],
        [
          "Gewünschter Zeitpunkt",
          s.timing === "date" && s.desiredDate
            ? `zum ${formatDay(`${s.desiredDate}T12:00:00Z`)}`
            : "zum nächstmöglichen Zeitpunkt, keine weitere Abbuchung",
        ],
        ["Gekündigt am", s.receivedAt ? formatDayTime(s.receivedAt) : ""],
        ["Vorgangsnummer", s.reference ?? ""],
      ]
    : [];
  return (
    <SiteShell mainClassName="pv-abo-cancel">
      <div className="pv-abo-cancel__blob" aria-hidden="true" />
      <div className="pv-container pv-before-footer relative grid gap-8 pt-8 pb-16 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-16 lg:pt-14">
        <div className="min-w-0">
          <Eyebrow>Vertrag kündigen</Eyebrow>
          <h1 className="headline text-pv-wildberry mt-3 text-[44px] leading-[1.05] lg:text-[64px]">
            Erledigt
          </h1>
          <section className="pv-abo-done mt-6" aria-labelledby="kuendigung-titel" role="status">
            <span
              className="bg-pv-wildberry text-pv-white flex size-14 items-center justify-center rounded-full lg:size-16"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" className="size-7">
                <path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h2
              id="kuendigung-titel"
              className="text-[24px] leading-[1.2] font-medium lg:text-[28px]"
            >
              Deine Kündigung ist bei uns eingegangen.
            </h2>
            {rows.length > 0 ? (
              <dl className="bg-pv-white flex flex-col gap-3 rounded-[18px] p-4">
                {rows.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-pv-wildberry text-[13px]">{k}</dt>
                    <dd className="text-[16px] font-bold break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <p className="text-[15px] leading-[1.55]">
              {s?.email
                ? `Die Bestätigung mit allen Angaben haben wir an ${s.email} geschickt. Bitte heb sie auf. Danke, dass du dabei warst.`
                : "Die Bestätigung mit allen Angaben haben wir an die angegebene E-Mail-Adresse geschickt. Bitte heb sie auf."}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href={"/collections/all" as Route} className="btn-primary">
                Zum Shop
              </Link>
              <Link
                href={"/collections/all" as Route}
                className="text-pv-wildberry font-bold underline underline-offset-4"
              >
                Doch wieder Lust? Neues Abo
              </Link>
            </div>
          </section>
        </div>
        <div className="lg:pt-[120px]">
          <GoodToKnow />
        </div>
      </div>
    </SiteShell>
  );
}
