import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SiteShell } from "@/components/layout/SiteShell";
import { formatDateDe } from "@/lib/content/format";
import type { TocEntry } from "@/lib/content/html";
import { getLegalDocument, LEGAL_PATHS, type LegalKind } from "@/lib/content/legal";
import { Breadcrumbs } from "./Breadcrumbs";
import { Blob, Eyebrow } from "./Decor";

/** Kurztitel für Brotkrumen und Meta-Beschreibung je Rechtstext. */
const META: Record<LegalKind, { crumb: string; description: string }> = {
  impressum: {
    crumb: "Impressum",
    description: "Impressum von provibe: Anbieter, Kontakt, Register und Aufsichtsbehörde.",
  },
  agb: {
    crumb: "AGB",
    description:
      "Allgemeine Geschäftsbedingungen und Kundeninformationen für Bestellungen bei provibe.",
  },
  widerruf: {
    crumb: "Widerrufsbelehrung",
    description:
      "Rückgabe- und Widerrufsbelehrung mit Muster-Widerrufsformular für Bestellungen bei provibe.",
  },
  versand: {
    crumb: "Versand",
    description: "Versandkosten, Lieferfristen und Zahlungsmöglichkeiten bei provibe.",
  },
  datenschutz: {
    crumb: "Datenschutzerklärung",
    description:
      "Datenschutzerklärung von provibe: welche Daten wir verarbeiten und welche Rechte du hast.",
  },
};

export async function legalMetadata(kind: LegalKind): Promise<Metadata> {
  const doc = await getLegalDocument(kind);
  const title = doc?.title ?? META[kind].crumb;
  const path = LEGAL_PATHS[kind];
  return {
    title,
    description: META[kind].description,
    alternates: { canonical: path },
    openGraph: { title: `${title} | provibe`, description: META[kind].description, url: path },
  };
}

function ChevronDown() {
  return (
    <svg
      className="pv-toc-chevron"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="#4A2F39"
        strokeWidth="1.66667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TocList({ toc }: { toc: TocEntry[] }) {
  return (
    <ol>
      {toc.map((t) => (
        <li key={t.id}>
          <a href={`#${t.id}`}>{t.label}</a>
        </li>
      ))}
    </ol>
  );
}

/**
 * Rechtstext nach Figma (26:5380 / 26:5504): Kopf mit Brotkrumen, Eyebrow, H1 und Stand,
 * Inhaltsverzeichnis aus den H2 (Desktop sticky links, Mobil als Akkordeon), Text max. 720 px,
 * Versionszeile unten. Wortlaut aus legal_document_versions, Sie-Form bleibt.
 */
export async function LegalDocumentPage({
  kind,
  before,
  after,
  compact,
  extra = [],
}: {
  kind: LegalKind;
  /** Inhalt vor dem Text (zum Beispiel Hinweis "Du willst widerrufen?") */
  before?: ReactNode;
  /** Inhalt nach dem Text, vor der Versionszeile */
  after?: ReactNode;
  /** Zeilen ohne Absatzabstand (Impressum) */
  compact?: boolean;
  /** Zusätzliche Abschnitte aus Shopdaten (zum Beispiel LUCID im Impressum), erscheinen auch im Inhalt */
  extra?: { id: string; heading: string; content: ReactNode }[];
}) {
  const doc = await getLegalDocument(kind);
  if (!doc) notFound();
  const stand = formatDateDe(doc.publishedAt);
  const toc = [...doc.toc, ...extra.map((e) => ({ id: e.id, label: e.heading }))];

  return (
    <SiteShell>
      <header className="pv-legal-head">
        <Blob
          name="hero-2"
          className="top-[-60px] right-[-90px] w-[260px] opacity-60 lg:right-[-60px] lg:w-[340px]"
        />
        <div className="pv-container relative z-[1]">
          <Breadcrumbs items={[{ name: META[kind].crumb, path: doc.path }]} />
          <Eyebrow className="mt-4">Rechtliches</Eyebrow>
          <h1>{doc.title}</h1>
          <p className="pv-stand">Stand: {stand}</p>
        </div>
      </header>

      <div className="pv-container pv-legal-grid">
        {toc.length > 1 ? (
          <nav aria-label="Inhalt" className="lg:sticky lg:top-[120px] lg:self-start">
            <details className="pv-toc pv-toc-mobile">
              <summary>
                Inhalt
                <ChevronDown />
              </summary>
              <TocList toc={toc} />
            </details>
            <div className="pv-toc pv-toc-desktop">
              <p className="pv-toc-title">Inhalt</p>
              <TocList toc={toc} />
            </div>
          </nav>
        ) : (
          <div className="hidden lg:block" />
        )}

        <article className="min-w-0">
          {before ? <div className="mb-8">{before}</div> : null}
          <div
            className={`pv-legal-body ${compact ? "pv-legal-body--compact" : ""}`}
            dangerouslySetInnerHTML={{ __html: doc.html }}
          />
          {extra.length > 0 ? (
            <div className={`pv-legal-body ${compact ? "pv-legal-body--compact" : ""}`}>
              {extra.map((e) => (
                <section key={e.id} aria-labelledby={e.id}>
                  <h2 id={e.id}>{e.heading}</h2>
                  {e.content}
                </section>
              ))}
            </div>
          ) : null}
          {after}
          <p className="pv-legal-meta">
            Version {doc.version}, veröffentlicht am {stand}
          </p>
        </article>
      </div>
    </SiteShell>
  );
}
