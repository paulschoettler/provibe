import type { Metadata } from "next";
import { Eyebrow, ProteinSticker } from "@/components/content/Decor";
import { Notice } from "@/components/forms";
import { SiteLink } from "@/components/layout/SiteLink";
import { SiteShell } from "@/components/layout/SiteShell";
import { AuthenticityNote } from "@/components/reviews/AuthenticityNote";
import { ReviewItemCard } from "@/components/reviews/ReviewItemCard";
import { resolveReviewToken } from "@/lib/reviews/data";
import { formatReviewDate } from "@/lib/reviews/logic";
import type { ReviewTokenResult } from "@/lib/reviews/types";

/**
 * Bewertungsseite (Figma "6 Bewertungen": Mobil 89:1763, Desktop 91:1867, ohne Link 92:2122).
 * Erreichbar nur über den Link aus der Bewertungsanfrage-Mail (?token=…). Dynamisch, nicht
 * indexierbar, Referrer nur innerhalb der Seite (der Token steht in der URL; "no-referrer" würde
 * den Origin-Header beim Absenden ohne JavaScript auf "null" setzen und die Server Action sperren).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Produkt bewerten",
  description: "Bewerte die Produkte deiner provibe-Bestellung.",
  robots: { index: false, follow: false },
  referrer: "same-origin",
  alternates: { canonical: "/bewerten" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReviewPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = first(params.token);
  const saved = first(params.gespeichert);
  if (!token) return <NoLinkView status="invalid" />;
  const ctx = await resolveReviewToken(token);
  if (ctx.status !== "ok") return <NoLinkView status={ctx.status} />;

  return (
    <SiteShell>
      <section className="bg-pink-light" aria-labelledby="bewerten-titel">
        <div className="pv-container flex flex-col gap-3.5 pt-9 pb-9 lg:flex-row lg:items-center lg:gap-12 lg:py-[72px]">
          <div className="flex flex-1 flex-col gap-3.5 lg:gap-[18px]">
            <Eyebrow>Bewerten</Eyebrow>
            <h1
              id="bewerten-titel"
              className="text-wine m-0 text-[44px] leading-[0.96] font-bold tracking-[-0.02em] lg:text-[72px] lg:leading-[0.95]"
            >
              Wie war dein Vibe?
            </h1>
            <p className="m-0 max-w-[640px] text-[17px] leading-[1.4] font-medium lg:text-[19px]">
              Bestellung {ctx.orderNumber} vom {formatReviewDate(ctx.placedAt)}.{" "}
              {ctx.items.length > 1
                ? "Bewerte jedes Produkt einzeln, das dauert keine Minute."
                : "Das dauert keine Minute."}
            </p>
            <AuthenticityNote className="lg:hidden" />
          </div>
          <div className="relative hidden h-[132px] w-[132px] shrink-0 lg:block" aria-hidden="true">
            <ProteinSticker className="!static !h-[132px] !w-[132px]" />
          </div>
        </div>
      </section>

      <div className="pv-container pv-before-footer grid gap-5 pt-6 lg:grid-cols-[minmax(0,752px)_minmax(0,1fr)] lg:gap-12 lg:pt-14">
        <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
          {ctx.items.length === 0 ? (
            <Notice variant="info" title="Hier gibt es nichts zu bewerten.">
              <p>
                In dieser Bestellung steckt kein Produkt, das wir bewerten lassen. Fragen? Schreib
                uns an hello@provibe-drinks.de.
              </p>
            </Notice>
          ) : (
            ctx.items.map((item) => (
              <ReviewItemCard
                key={item.productId}
                item={item}
                token={token}
                justSaved={saved === item.productId}
              />
            ))
          )}
          {ctx.items.some((i) => i.existing) ? (
            <p className="m-0 text-[15px]">
              Fertig?{" "}
              <SiteLink
                href="/bewerten/danke"
                className="font-semibold underline underline-offset-4"
              >
                Zur Bestätigung
              </SiteLink>
            </p>
          ) : null}
        </div>
        <aside className="flex min-w-0 flex-col gap-5" aria-label="So prüfen wir Bewertungen">
          <AuthenticityNote className="hidden lg:flex" />
          <HowWeCheck />
          <p className="text-plum m-0 text-[14px] leading-[1.45]">
            Fragen zu deiner Bestellung? Schreib uns an{" "}
            <a href="mailto:hello@provibe-drinks.de" className="underline underline-offset-2">
              hello@provibe-drinks.de
            </a>
            .
          </p>
        </aside>
      </div>
    </SiteShell>
  );
}

function HowWeCheck() {
  const points = [
    "Bewerten geht nur über den Link aus deiner Bestellmail.",
    "Wir lesen jede Bewertung, bevor sie online geht, und veröffentlichen positive wie kritische.",
    "Ein Produkt, eine Bewertung. Ändern kannst du sie innerhalb von 60 Tagen über denselben Link.",
  ];
  return (
    <section
      className="border-aubergine/15 flex flex-col gap-3 rounded-[26px] border-[1.5px] px-[18px] py-[22px] lg:gap-3.5 lg:px-6 lg:py-[26px]"
      aria-labelledby="so-pruefen-wir"
    >
      <h2
        id="so-pruefen-wir"
        className="text-wine m-0 text-[20px] leading-[1.2] font-semibold lg:text-[22px]"
      >
        So bleiben Bewertungen echt
      </h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5 text-[15px] leading-[1.45]">
            <span
              className="bg-magenta mt-[7px] h-2 w-2 shrink-0 rounded-full"
              aria-hidden="true"
            />
            {p}
          </li>
        ))}
      </ul>
    </section>
  );
}

const NO_LINK_TEXT: Record<
  Exclude<ReviewTokenResult["status"], "ok">,
  { title: string; text: string }
> = {
  invalid: {
    title: "Bewerten geht nur mit deinem Link",
    text: "Damit nur echte Käuferinnen und Käufer bewerten, schicken wir dir nach der Lieferung eine Mail mit einem persönlichen Link. Der Link gilt 60 Tage. Ist er unvollständig oder funktioniert nicht, schreib uns kurz, dann schicken wir dir einen neuen.",
  },
  expired: {
    title: "Dein Bewertungslink ist abgelaufen",
    text: "Bewertungslinks gelten 60 Tage ab der Mail. Möchtest du trotzdem noch bewerten, schreib uns kurz, dann schicken wir dir einen neuen Link.",
  },
  not_delivered: {
    title: "Erst auspacken, dann bewerten",
    text: "Deine Bestellung ist bei uns noch nicht als zugestellt vermerkt. Sobald sie angekommen ist, kannst du über denselben Link bewerten.",
  },
  cancelled: {
    title: "Diese Bestellung kann nicht bewertet werden",
    text: "Die Bestellung wurde storniert oder erstattet. Bewertungen sind nur für gelieferte Bestellungen möglich.",
  },
  error: {
    title: "Das hat gerade nicht geklappt",
    text: "Wir konnten deinen Bewertungslink gerade nicht prüfen. Bitte versuch es in ein paar Minuten noch einmal.",
  },
};

function NoLinkView({ status }: { status: Exclude<ReviewTokenResult["status"], "ok"> }) {
  const copy = NO_LINK_TEXT[status];
  return (
    <SiteShell>
      <div className="pv-container pv-before-footer flex max-w-[720px] flex-col gap-4 pt-10 lg:pt-16">
        <Eyebrow>Bewerten</Eyebrow>
        <h1 className="text-wine m-0 text-[34px] leading-[1.05] font-semibold tracking-[-0.01em] lg:text-[48px]">
          {copy.title}
        </h1>
        <p className="m-0 text-[16px] leading-[1.5] lg:text-[17px]">{copy.text}</p>
        <Notice variant="info" title="Deine Bestellungen im Konto">
          <p>Im Kundenkonto siehst du alle Bestellungen und ihren Lieferstatus.</p>
        </Notice>
        <div className="flex flex-wrap gap-3">
          <SiteLink href="/account/bestellungen" className="pv-btn-secondary">
            Zu meinen Bestellungen
          </SiteLink>
          <a href="mailto:hello@provibe-drinks.de" className="pv-btn-secondary">
            Neuen Link anfordern
          </a>
        </div>
        <AuthenticityNote />
      </div>
    </SiteShell>
  );
}
