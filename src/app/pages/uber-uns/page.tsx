import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { FruitSticker } from "@/components/brand/FruitSticker";
import { Blob, Eyebrow, ProteinSticker, WaveCut } from "@/components/content/Decor";
import { JsonLd, absoluteUrl } from "@/components/content/JsonLd";
import { Accordion } from "@/components/forms";
import { SiteLink } from "@/components/layout/SiteLink";
import { SiteShell } from "@/components/layout/SiteShell";
import { WaveDivider } from "@/components/layout/WaveDivider";
import { htmlNodes } from "@/lib/content/html";
import { getPage } from "@/lib/content/pages";
import { getShopSettings } from "@/lib/content/settings";

/** Story-Seite: Inhalt aus pages/page_translations (Handle uber-uns), statisch, stündlich erneuert. */
export const revalidate = 3600;

const DESCRIPTION =
  "Eine Gründerin, drei Sorten: Wie Celine aus einer Idee im Studium provibe gemacht hat, den Eistee mit 15 g Protein und ohne Zucker.";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("uber-uns");
  return {
    title: page?.seoTitle ?? "Über uns",
    description: page?.seoDescription ?? DESCRIPTION,
    alternates: { canonical: "/pages/uber-uns" },
    openGraph: {
      title: "Über uns | provibe",
      description: page?.seoDescription ?? DESCRIPTION,
      url: "/pages/uber-uns",
      images: [
        {
          url: "/images/story-bag.jpg",
          width: 1600,
          height: 1063,
          alt: "Celine mit provibe im Kofferraum",
        },
      ],
    },
  };
}

interface StoryBlock {
  number: string;
  heading: string;
  html: string;
}

/** Blöcke aus dem gespeicherten HTML: Nummer (p), Überschrift (h2), Text (p). */
function storyBlocks(bodyHtml: string): StoryBlock[] {
  const nodes = htmlNodes(bodyHtml);
  const blocks: StoryBlock[] = [];
  nodes.forEach((n, i) => {
    if (n.tag !== "h2") return;
    const prev = nodes[i - 1];
    const next = nodes[i + 1];
    blocks.push({
      number:
        prev && /^\d{1,2}$/.test(prev.text)
          ? prev.text
          : String(blocks.length + 1).padStart(2, "0"),
      heading: n.text,
      html: next && next.tag === "p" ? next.html : "",
    });
  });
  return blocks;
}

/** Bilder und Deko je Block nach Figma (23:1054 / 23:1261). */
const BLOCK_MEDIA = [
  {
    src: "/images/story-bag.jpg",
    width: 1600,
    height: 1063,
    alt: "Celine liegt entspannt im offenen Kofferraum, draußen ein sonniger Olivenhain",
    blob: "bild-a" as const,
    sticker: (
      <FruitSticker
        kind="erdbeere"
        rotate={8}
        className="top-[-28px] right-[-10px] w-[76px] lg:w-[104px]"
      />
    ),
  },
  {
    src: "/images/mood-bw.jpg",
    width: 1800,
    height: 1365,
    alt: "Eine Hand hält eine Dose provibe Wildberry über das blaue Meer",
    blob: "bild-b" as const,
    sticker: <ProteinSticker rotate={-8} className="top-[-34px] left-[-12px]" />,
  },
  {
    src: "/images/purse-circle.jpg",
    width: 1200,
    height: 1600,
    alt: "Eine Dose provibe Wildberry steckt in einer weißen Handtasche",
    blob: "bild-a" as const,
    sticker: (
      <FruitSticker
        kind="pfirsich-blatt-gross"
        rotate={0}
        className="top-[-26px] right-[-14px] w-[84px] lg:w-[112px]"
      />
    ),
  },
];

export default async function UberUnsPage() {
  const [page, settings] = await Promise.all([getPage("uber-uns"), getShopSettings()]);
  if (!page) notFound();
  const blocks = storyBlocks(page.bodyHtml);
  const founder = settings.legalEntity.managingDirector;
  const firstName = founder.split(" ")[0] || "Celine";

  const facts = [
    {
      id: "wer-steckt-hinter-provibe",
      question: "Wer steckt hinter provibe?",
      answer: `provibe wurde von ${founder} gegründet. Anbieter ist die ${settings.legalEntity.name} aus ${settings.legalEntity.city}.`,
    },
    {
      id: "was-ist-provibe",
      question: "Was ist provibe?",
      answer:
        "Ein trinkfertiger Eistee mit 15 g Protein je 0,33-l-Dose, ohne Zucker. Es gibt drei Sorten: Wildberry, Raspberry Lime und Peach.",
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: "Über uns",
      url: absoluteUrl("/pages/uber-uns"),
      description: DESCRIPTION,
      mainEntity: {
        "@type": "Organization",
        name: "provibe",
        legalName: settings.legalEntity.name,
        url: absoluteUrl("/"),
        email: settings.contact.email,
        founder: { "@type": "Person", name: founder },
        address: {
          "@type": "PostalAddress",
          streetAddress: settings.legalEntity.street,
          postalCode: settings.legalEntity.zip,
          addressLocality: settings.legalEntity.city,
          addressCountry: "DE",
        },
        sameAs: [settings.social.instagram, settings.social.tiktok],
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: facts.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
  ];

  return (
    <SiteShell>
      <JsonLd data={jsonLd} />

      {/* Hero im Wildberry-Verlauf mit Blobs, Stickern und Welle */}
      <section
        className="pv-hero-grad pv-hero-grad--berry pv-story-hero"
        aria-labelledby="story-titel"
      >
        <Blob
          name="hero-1"
          className="top-[-70px] left-[-120px] w-[280px] lg:top-[-140px] lg:left-[-180px] lg:w-[620px]"
        />
        <Blob
          name="hero-2"
          className="top-[170px] left-[60%] w-[240px] lg:top-[-40px] lg:right-[-100px] lg:left-auto lg:w-[480px]"
        />
        <FruitSticker
          kind="heidelbeere"
          rotate={-10}
          className="top-[-6px] right-[6px] w-[64px] lg:top-[120px] lg:right-auto lg:left-[17%] lg:w-[92px]"
        />
        <FruitSticker
          kind="pfirsich-blatt-gross"
          className="hidden lg:top-[380px] lg:left-[21%] lg:block lg:w-[108px]"
        />
        <div className="pv-container relative z-[1] flex flex-col gap-[14px]">
          <Eyebrow>Über uns</Eyebrow>
          <h1 id="story-titel" className="pv-display">
            <span>Eine Gründerin.</span> <span>Drei Sorten.</span>
          </h1>
          <p className="pv-lead lg:mx-auto lg:max-w-[560px]">
            Wie aus einer Idee im Studium ein Eistee mit 15 g Protein wurde.
          </p>
        </div>
        <ProteinSticker
          rotate={8}
          className="right-[24px] bottom-[34px] lg:top-[300px] lg:right-[17%] lg:bottom-auto"
        />
      </section>
      <WaveCut />

      {/* Drei Blöcke: Idee, Entwicklung, Vision; Zitatband nach dem zweiten */}
      {blocks.map((block, i) => {
        const media = BLOCK_MEDIA[i % BLOCK_MEDIA.length];
        const reverse = i % 2 === 1;
        return (
          <div key={block.heading}>
            <section
              className={`pv-container pv-story-block ${reverse ? "pv-story-block--reverse" : ""}`}
              aria-labelledby={`block-${i}`}
            >
              <div className="pv-story-media">
                <Blob
                  name={media.blob}
                  className={reverse ? "left-[10%] lg:left-[16%]" : "left-[-6%]"}
                />
                <Image
                  src={media.src}
                  alt={media.alt}
                  width={media.width}
                  height={media.height}
                  sizes="(min-width: 861px) 560px, calc(100vw - 32px)"
                  className="pv-story-photo"
                  priority={i === 0}
                />
                {media.sticker}
              </div>
              <div className="flex flex-col gap-2">
                <p className="pv-story-num" aria-hidden="true">
                  {block.number}
                </p>
                <h2 id={`block-${i}`} className="pv-h2">
                  {block.heading}
                </h2>
                <p className="pv-body" dangerouslySetInnerHTML={{ __html: block.html }} />
              </div>
            </section>

            {i === 1 ? (
              <section className="pv-story-quote" aria-label="Zitat der Gründerin">
                <WaveDivider shape="soft" fill="var(--pv-lime-raspberry)" position="top" />
                <Blob
                  name="zitat"
                  className="top-[60px] right-[-30px] w-[160px] lg:top-[80px] lg:right-[-20px] lg:w-[300px]"
                />
                <div className="pv-container">
                  <blockquote>
                    <span className="pv-story-quote-mark" aria-hidden="true">
                      „
                    </span>
                    <p>
                      Protein soll endlich als mehr gesehen werden als nur ein Sportnahrungsmittel.
                    </p>
                    <footer>{firstName}, Gründerin von provibe</footer>
                  </blockquote>
                </div>
                <WaveDivider shape="soft" fill="var(--pv-lime-raspberry)" position="bottom" flip />
              </section>
            ) : null}
          </div>
        );
      })}

      {/* Kurz gefragt: klare Fakten für Suchmaschinen und KI-Antworten (Briefing 7, GEO) */}
      <section
        className="pv-container py-10 lg:max-w-[760px] lg:py-16"
        aria-labelledby="fakten-titel"
      >
        <Eyebrow>Kurz gefragt</Eyebrow>
        <h2 id="fakten-titel" className="pv-h2 mt-3 mb-4">
          provibe in zwei Sätzen
        </h2>
        <Accordion
          headingLevel={3}
          defaultOpenId={facts[0].id}
          items={facts.map((f) => ({ ...f, answer: <p>{f.answer}</p> }))}
        />
      </section>

      {/* Abschluss mit den drei Sorten */}
      <section
        className="pv-container pv-before-footer flex flex-col items-center gap-[14px] pt-6 text-center"
        aria-labelledby="sorten-titel"
      >
        <div className="pv-cans-trio" aria-hidden="true">
          <Blob name="dosen" className="top-[3.5%] left-[6%] !h-[93%] w-[88%]" />
          <Image
            src="/images/cans/raspberry-lime.png"
            alt=""
            width={405}
            height={760}
            sizes="200px"
            className="pv-can-shadow top-[22%] left-[14%] z-[1] w-[26%] rotate-[-9deg]"
          />
          <Image
            src="/images/cans/peach.png"
            alt=""
            width={405}
            height={760}
            sizes="200px"
            className="pv-can-shadow top-[13%] left-[61%] z-[1] w-[26%] rotate-[9deg]"
          />
          <Image
            src="/images/cans/wildberry.png"
            alt=""
            width={750}
            height={1400}
            sizes="200px"
            className="pv-can-shadow top-[10%] left-[35.8%] z-[2] w-[28.3%]"
          />
          <ProteinSticker rotate={10} className="top-[5%] left-[51%]" />
        </div>
        <h2 id="sorten-titel" className="pv-h2 lg:text-[56px]">
          Such dir deinen Vibe.
        </h2>
        <p className="pv-body max-w-[560px]">
          Wildberry, Raspberry Lime und Peach. Jede Dose mit 15 g Protein und ohne Zucker.
        </p>
        <div className="pt-2">
          <SiteLink href="/pages/shop" className="pv-btn-primary">
            Zum Shop
          </SiteLink>
        </div>
      </section>
    </SiteShell>
  );
}
