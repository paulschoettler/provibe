import type { ReactNode } from "react";
import { SiteLink } from "@/components/layout/SiteLink";
import { SiteShell } from "@/components/layout/SiteShell";
import { Blob, Eyebrow, InhaltIcon, WaveCut } from "./Decor";

/**
 * Bestätigungsseite nach einem Formular (Figma 24:2883 "Partner gesendet").
 * Wird ohne JavaScript per Redirect erreicht; die Zusammenfassung kommt aus einem
 * kurzlebigen httpOnly-Cookie, nicht aus der URL.
 */
export function SentPage({
  eyebrow,
  title,
  text,
  summaryTitle = "Deine Angaben",
  summary,
  footnote,
  children,
  tone = "peach",
}: {
  eyebrow: string;
  title: string;
  text: ReactNode;
  summaryTitle?: string;
  summary?: [string, string][] | null;
  footnote?: ReactNode;
  children?: ReactNode;
  tone?: "peach" | "berry";
}) {
  return (
    <SiteShell>
      <section
        className={`pv-hero-grad ${tone === "peach" ? "pv-hero-grad--peach" : "pv-hero-grad--soft"} pt-10 pb-[100px] text-center lg:pt-16 lg:pb-[140px]`}
        aria-labelledby="gesendet-titel"
      >
        <Blob
          name="partner-1"
          className="top-[-40px] right-[-90px] w-[260px] lg:right-[-40px] lg:w-[460px]"
        />
        <Blob name="partner-2" className="top-[220px] left-[-100px] w-[200px] lg:w-[320px]" />
        <div className="pv-container relative z-[1] flex flex-col items-center gap-4">
          <span className="pv-success-badge" aria-hidden="true">
            <InhaltIcon name="check-white" size={44} />
          </span>
          <Eyebrow className="mt-2">{eyebrow}</Eyebrow>
          <h1
            id="gesendet-titel"
            className="pv-h2 max-w-[640px] !text-[34px] !font-bold lg:!text-[56px]"
          >
            {title}
          </h1>
          <div className="pv-body max-w-[560px]">{text}</div>
        </div>
      </section>
      <WaveCut />
      <div className="pv-container pv-before-footer flex max-w-[640px] flex-col items-center gap-4 pt-6">
        {summary && summary.length > 0 ? (
          <section
            className="pv-card-soft w-full !rounded-[10px] px-5 py-5"
            aria-labelledby="angaben-titel"
          >
            <h2 id="angaben-titel" className="text-wine m-0 mb-2 text-[20px] font-semibold">
              {summaryTitle}
            </h2>
            <dl className="m-0">
              {summary.map(([k, v]) => (
                <div key={k} className="pv-summary-row">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        {children}
        <div className="flex flex-col items-center gap-3 pt-2">
          <SiteLink href="/pages/shop" className="pv-btn-primary">
            Zum Shop
          </SiteLink>
          <SiteLink href="/" className="pv-btn-secondary">
            Zur Startseite
          </SiteLink>
        </div>
        {footnote ? <p className="text-plum m-0 text-center text-[15px]">{footnote}</p> : null}
      </div>
    </SiteShell>
  );
}
