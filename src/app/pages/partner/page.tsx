import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Blob, Eyebrow, InhaltIcon, ProteinSticker, WaveCut } from "@/components/content/Decor";
import { JsonLd, breadcrumbJsonLd } from "@/components/content/JsonLd";
import { PartnerForm } from "@/components/content/PartnerForm";
import { SiteShell } from "@/components/layout/SiteShell";
import { capitalize, htmlNodes, type HtmlNode } from "@/lib/content/html";
import { getPage } from "@/lib/content/pages";
import { getShopSettings } from "@/lib/content/settings";

/** Partnerseite (B2B): Text aus pages (Handle partner), Formular schreibt in leads. */
export const revalidate = 3600;

const DESCRIPTION =
  "provibe für Fitnessstudios, Einzelhandel, Gastronomie und Hotellerie: attraktive Konditionen, flexible Bestellmengen und unkomplizierte Abwicklung. Jetzt Partneranfrage stellen.";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("partner");
  return {
    title: page?.seoTitle ?? "Partner",
    description: page?.seoDescription ?? DESCRIPTION,
    alternates: { canonical: "/pages/partner" },
    openGraph: {
      title: "Partner | provibe",
      description: page?.seoDescription ?? DESCRIPTION,
      url: "/pages/partner",
    },
  };
}

const PILLS = [
  { label: "Fitnessstudio", pink: false },
  { label: "Functional Training", pink: true },
  { label: "Einzelhandel", pink: false },
  { label: "Gastronomie", pink: true },
  { label: "Hotellerie", pink: false },
];

/** Sticker je Vorteil (Figma 24:2519 bis 24:2535) und Texte, falls der Listenpunkt keinen Zusatz hat. */
const BENEFIT_STYLE = [
  {
    icon: "percent" as const,
    bg: "var(--pv-wildberry)",
    rot: 6,
    fallback: "Konditionen, Mengen und Abläufe besprechen wir direkt mit dir.",
  },
  {
    icon: "boxes" as const,
    bg: "var(--pv-lime-raspberry)",
    rot: -5,
    fallback: "Ideal für Tests und Erstbestellungen.",
  },
  {
    icon: "bolt" as const,
    bg: "var(--pv-peach)",
    rot: 4,
    fallback: "Wir beliefern unsere B2B-Partner direkt und unkompliziert.",
  },
];

/** Inhalte aus dem gespeicherten Shopify-Text lesen, Wortlaut bleibt erhalten. */
function partnerContent(nodes: HtmlNode[]) {
  const h1 = nodes.find((n) => n.tag === "h1");
  const h1Index = h1 ? nodes.indexOf(h1) : -1;
  const intro = nodes.slice(h1Index + 1).find((n) => n.tag === "p");
  const items = nodes.filter((n) => n.tag === "li").map((n) => n.text);
  const h2 = nodes.find((n) => n.tag === "h2");
  const h2Index = h2 ? nodes.indexOf(h2) : -1;
  const ask = h2Index >= 0 ? nodes[h2Index + 1] : undefined;
  const network = nodes.find((n) => n.tag === "p" && n.text.startsWith("Wir arbeiten bereits"));
  return {
    title: h1?.text ?? "Provibe für dein Geschäft oder Gym",
    introHtml: intro?.html ?? "",
    items,
    askTitle: h2?.text ?? "Wir freuen uns auf deine Anfrage",
    askHtml: ask?.tag === "p" ? ask.html : "",
    networkText: network?.text ?? "",
  };
}

export default async function PartnerPage() {
  const [page, settings] = await Promise.all([getPage("partner"), getShopSettings()]);
  if (!page) notFound();
  const c = partnerContent(htmlNodes(page.bodyHtml));
  const benefits = c.items.slice(0, 3).map((item, i) => {
    const [head, ...rest] = item.split(/\s+–\s+/);
    const style = BENEFIT_STYLE[i] ?? BENEFIT_STYLE[0];
    return {
      title: capitalize(head),
      text: rest.length > 0 ? `${capitalize(rest.join(" – "))}.` : style.fallback,
      ...style,
    };
  });
  const claim = c.items[3];
  const partnerMail = settings.contact.partnerEmail;

  return (
    <SiteShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Startseite", path: "/" },
          { name: "Partner", path: "/pages/partner" },
        ])}
      />

      {/* Hero im Peach-Verlauf */}
      <section
        className="pv-hero-grad pv-hero-grad--peach pt-10 pb-[110px] lg:pt-[60px] lg:pb-[150px]"
        aria-labelledby="partner-titel"
      >
        <Blob
          name="partner-1"
          className="top-[-60px] right-[-70px] w-[260px] lg:top-[-20px] lg:right-[-40px] lg:w-[520px]"
        />
        <Blob
          name="partner-2"
          className="top-[300px] left-[-90px] w-[200px] lg:top-[300px] lg:left-[-120px] lg:w-[320px]"
        />
        <div className="pv-container relative z-[1] grid items-center gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          <div className="flex flex-col gap-[14px]">
            <Eyebrow>Für Partner</Eyebrow>
            <h1 id="partner-titel" className="pv-display lg:text-[80px]">
              {c.title}
            </h1>
            <p className="pv-body" dangerouslySetInnerHTML={{ __html: c.introHtml }} />
            <ul className="flex flex-wrap gap-2" aria-label="Für wen provibe passt">
              {PILLS.map((p) => (
                <li key={p.label} className={`pv-pill ${p.pink ? "pv-pill--pink" : ""}`}>
                  {p.label}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-x-3 gap-y-[10px] pt-1">
              <a href="#anfrage" className="pv-btn-primary">
                Anfrage stellen
              </a>
              <a href={`mailto:${partnerMail}`} className="pv-btn-secondary">
                {partnerMail}
              </a>
            </div>
          </div>
          <div
            className="relative mx-auto aspect-[358/250] w-full max-w-[560px]"
            aria-hidden="true"
          >
            <Image
              src="/images/cans/wildberry.png"
              alt=""
              width={750}
              height={1400}
              sizes="(min-width: 1024px) 180px, 100px"
              className="pv-can-shadow absolute top-[14%] left-[7%] w-[25%] rotate-[10deg]"
            />
            <Image
              src="/images/cans/raspberry-lime.png"
              alt=""
              width={405}
              height={760}
              sizes="(min-width: 1024px) 180px, 100px"
              className="pv-can-shadow absolute top-[16%] left-[60%] w-[26%] rotate-[-10deg]"
            />
            <Image
              src="/images/cans/peach.png"
              alt=""
              width={405}
              height={760}
              sizes="(min-width: 1024px) 200px, 112px"
              className="pv-can-shadow absolute top-[6%] left-[34%] z-[1] w-[31%]"
            />
            <ProteinSticker rotate={-8} className="top-[-8%] left-[14%] lg:left-[22%]" />
          </div>
        </div>
      </section>
      <WaveCut />

      {/* Vorteile als Sticker-Karten */}
      <section
        className="pv-container flex flex-col gap-5 pt-9 pb-12 lg:items-center lg:pt-14 lg:pb-16"
        aria-labelledby="vorteile-titel"
      >
        <Eyebrow>Darum provibe</Eyebrow>
        <h2 id="vorteile-titel" className="pv-h2">
          Deine Vorteile
        </h2>
        <ul className="grid w-full gap-4 lg:grid-cols-3">
          {benefits.map((b) => (
            <li key={b.title} className="pv-benefit-card">
              <span
                className="pv-benefit-sticker"
                style={{ background: b.bg, ["--pv-rot" as string]: `${b.rot}deg` }}
                aria-hidden="true"
              >
                <InhaltIcon name={b.icon} size={28} />
              </span>
              <h3 className="text-pv-wildberry m-0 text-[21px] leading-[1.2] font-medium">
                {b.title}
              </h3>
              <p className="pv-body !text-[16px]">{b.text}</p>
            </li>
          ))}
        </ul>
        {claim ? (
          <p className="pv-claim-sticker mt-2 lg:mt-6 lg:px-6 lg:text-[18px]">
            {capitalize(claim)}.
          </p>
        ) : null}
      </section>

      {/* Anfrage mit Formular */}
      <section
        id="anfrage"
        className="pv-container pv-before-footer relative grid scroll-mt-28 gap-6 pt-6 lg:grid-cols-[1fr_1.45fr] lg:gap-16 lg:pt-12"
        aria-labelledby="anfrage-titel"
      >
        <Blob
          name="partner-3"
          className="top-[-20px] left-[60%] w-[220px] lg:top-[80px] lg:left-[-140px] lg:w-[300px]"
        />
        <div className="relative z-[1] flex flex-col gap-4">
          <Eyebrow>Anfrage</Eyebrow>
          <h2 id="anfrage-titel" className="pv-h2">
            {c.askTitle}
          </h2>
          <p className="pv-body !text-[16px]" dangerouslySetInnerHTML={{ __html: c.askHtml }} />
          <div className="pv-channel">
            <span className="pv-icon-circle !bg-pv-lime-raspberry" aria-hidden="true">
              <InhaltIcon name="mail" />
            </span>
            <span>
              <span className="pv-channel-label">Lieber per E-Mail?</span>
              <a href={`mailto:${partnerMail}`} className="pv-channel-value !text-[17px]">
                {partnerMail}
              </a>
            </span>
          </div>
          {c.networkText ? (
            <p className="text-pv-wildberry m-0 text-[15px] leading-[1.55]">{c.networkText}</p>
          ) : null}
        </div>
        <div className="relative z-[1]">
          <PartnerForm />
        </div>
      </section>
    </SiteShell>
  );
}
