import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ContactCard } from "@/components/content/ContactCard";
import { ContactForm } from "@/components/content/ContactForm";
import { Blob, Eyebrow, InhaltIcon, ProteinSticker, WaveCut } from "@/components/content/Decor";
import { JsonLd, absoluteUrl } from "@/components/content/JsonLd";
import { Accordion } from "@/components/forms";
import { SiteLink } from "@/components/layout/SiteLink";
import { SiteShell } from "@/components/layout/SiteShell";
import { htmlNodes } from "@/lib/content/html";
import { getPage } from "@/lib/content/pages";
import { getShopSettings } from "@/lib/content/settings";
import { ogImages } from "@/lib/seo/og";

/** Kontaktseite: Text aus pages (Handle contact), Formular schreibt in contact_messages. */
export const revalidate = 3600;

const DESCRIPTION =
  "Fragen, Feedback oder geschäftliche Anfragen? Schreib provibe über das Kontaktformular oder an hello@provibe-drinks.de. Antwort innerhalb von 24 Stunden.";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("contact");
  return {
    title: page?.seoTitle ?? "Kontakt",
    description: page?.seoDescription ?? DESCRIPTION,
    alternates: { canonical: "/pages/contact" },
    openGraph: {
      title: "Kontakt | provibe",
      description: page?.seoDescription ?? DESCRIPTION,
      url: "/pages/contact",
      images: ogImages(page?.ogImagePath, "Kontakt zu provibe"),
    },
  };
}

/** FAQ-Teaser (H7: Texte aus Repo-Daten formuliert, Abnahme durch den Auftraggeber). */
const FAQ = [
  {
    id: "faq-versand",
    question: "Was kostet der Versand?",
    answer:
      "Wir liefern innerhalb Deutschlands für 4,90 €. Ab 50 € Bestellwert ist der Versand kostenlos. Die Lieferung dauert 3 bis 5 Werktage.",
  },
  {
    id: "faq-pfand",
    question: "Ist auf den Dosen Pfand?",
    answer: "Ja, pro Dose fallen 0,25 € Pfand an. Wir weisen das Pfand immer neben dem Preis aus.",
  },
  {
    id: "faq-protein",
    question: "Wie viel Protein steckt in einer Dose?",
    answer: "Jede 0,33-l-Dose enthält 15 g Protein aus Milch (Molkenprotein) und keinen Zucker.",
  },
];

export default async function ContactPage() {
  const [page, settings] = await Promise.all([getPage("contact"), getShopSettings()]);
  if (!page) notFound();
  const nodes = htmlNodes(page.bodyHtml);
  const title = nodes.find((n) => n.tag === "h1")?.text ?? "Wir sind für dich da";
  const lead = nodes.find((n) => n.tag === "p" && n.text.length > 30);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: "Kontakt",
      url: absoluteUrl("/pages/contact"),
      mainEntity: {
        "@type": "Organization",
        name: "provibe",
        legalName: settings.legalEntity.name,
        email: settings.contact.email,
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer service",
            email: settings.contact.email,
            availableLanguage: "de",
          },
          {
            "@type": "ContactPoint",
            contactType: "sales",
            email: settings.contact.partnerEmail,
            availableLanguage: "de",
          },
        ],
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
  ];

  return (
    <SiteShell>
      <JsonLd data={jsonLd} />

      <section
        className="pv-hero-grad pv-hero-grad--berry pt-10 pb-[90px] lg:pt-[72px] lg:pb-[130px] lg:text-center"
        aria-labelledby="kontakt-titel"
      >
        <Blob
          name="hero-2"
          className="top-[-50px] right-[-40px] w-[250px] lg:top-auto lg:right-[-80px] lg:bottom-[-120px] lg:w-[420px]"
        />
        <Blob
          name="hero-1"
          className="top-[230px] left-[-90px] w-[200px] lg:top-[-120px] lg:left-[-140px] lg:w-[520px]"
        />
        <Image
          src="/images/cans/wildberry.png"
          alt=""
          aria-hidden="true"
          width={750}
          height={1400}
          sizes="140px"
          className="pv-can-shadow absolute top-[90px] left-[-1%] z-[1] hidden w-[130px] rotate-[22deg] lg:block"
        />
        <Image
          src="/images/cans/raspberry-lime.png"
          alt=""
          aria-hidden="true"
          width={405}
          height={760}
          sizes="160px"
          className="pv-can-shadow absolute top-[40px] right-[4%] z-[1] hidden w-[150px] rotate-[-14deg] lg:block"
        />
        <ProteinSticker
          rotate={8}
          className="top-[36px] right-[22px] lg:top-[170px] lg:right-[14%]"
        />
        <div className="pv-container relative z-[1] flex flex-col gap-[14px] lg:items-center">
          <Eyebrow>Kontakt</Eyebrow>
          <h1 id="kontakt-titel" className="pv-display max-w-[70%] lg:max-w-none lg:text-[80px]">
            {title}
          </h1>
          {lead ? (
            <p
              className="pv-lead lg:max-w-[640px]"
              dangerouslySetInnerHTML={{ __html: lead.html }}
            />
          ) : null}
        </div>
      </section>
      <WaveCut />

      <div className="pv-container grid gap-6 pt-2 pb-8 lg:grid-cols-[1.9fr_1fr] lg:gap-8 lg:pt-6">
        <ContactForm />
        <div className="lg:self-start">
          <ContactCard settings={settings} />
        </div>
      </div>

      <section
        className="pv-container pv-before-footer grid gap-4 pt-8 lg:grid-cols-[1fr_1.5fr] lg:gap-16 lg:pt-16"
        aria-labelledby="faq-titel"
      >
        <div className="flex flex-col gap-[14px]">
          <Eyebrow>Häufige Fragen</Eyebrow>
          <h2 id="faq-titel" className="pv-h2">
            Kurz beantwortet
          </h2>
          <SiteLink href="/pages/versand" className="pv-textlink">
            Mehr zu Versand und Zahlung
            <InhaltIcon name="arrow" size={18} />
          </SiteLink>
        </div>
        <Accordion
          defaultOpenId="faq-versand"
          items={FAQ.map((f) => ({ id: f.id, question: f.question, answer: <p>{f.answer}</p> }))}
        />
      </section>
    </SiteShell>
  );
}
