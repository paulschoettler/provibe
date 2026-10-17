import type { Metadata } from "next";
import { Blob, Eyebrow, FruitSticker, WaveCut } from "@/components/content/Decor";
import { FlavorTeaserCards } from "@/components/content/FlavorTeaserCards";
import { SiteLink } from "@/components/layout/SiteLink";
import { SiteShell } from "@/components/layout/SiteShell";
import { getHomeData, type HomeFlavor } from "@/lib/catalog/home";

/**
 * 404 nach Figma (28:6727 / 28:6944): Sortenverlauf, große Headline, Suche (GET auf /search,
 * funktioniert ohne JavaScript), Buttons und drei Sortenkarten. Status 404, noindex.
 */
export const metadata: Metadata = {
  title: "Seite nicht gefunden",
  description: "Diese Seite gibt es nicht mehr. Such nach deiner Sorte oder schau im Shop vorbei.",
  robots: { index: false, follow: true },
};

async function loadFlavors(): Promise<HomeFlavor[]> {
  try {
    return (await getHomeData()).flavors;
  } catch (error) {
    console.error("[404] Sorten nicht ladbar", error);
    return [];
  }
}

export default async function NotFound() {
  const flavors = await loadFlavors();
  return (
    <SiteShell>
      <section
        className="pv-hero-grad pv-hero-grad--berry pv-404-hero"
        aria-labelledby="fehler-titel"
      >
        <Blob
          name="hero-1"
          className="top-[-80px] left-[-140px] w-[300px] lg:top-[-160px] lg:left-[-220px] lg:w-[680px]"
        />
        <Blob
          name="hero-2"
          className="top-[260px] right-[-120px] w-[260px] lg:top-[230px] lg:right-[-140px] lg:w-[520px]"
        />
        <span className="pv-404-ghost" aria-hidden="true">
          404
        </span>
        <FruitSticker
          kind="brombeere"
          rotate={-8}
          className="top-[24px] left-[4%] w-[52px] lg:top-[210px] lg:left-[18%] lg:w-[72px]"
        />
        <FruitSticker
          kind="erdbeere"
          rotate={10}
          className="top-[18px] right-[5%] w-[50px] lg:top-[190px] lg:right-[19%] lg:w-[70px]"
        />
        <FruitSticker
          kind="pfirsich"
          rotate={4}
          className="top-[420px] right-[8%] hidden w-[78px] lg:top-[400px] lg:right-[12%] lg:block"
        />
        <div className="pv-container relative z-[1] flex flex-col items-center gap-4">
          <Eyebrow>Fehler 404</Eyebrow>
          <h1 id="fehler-titel" className="pv-display max-w-[660px] !text-[48px] lg:!text-[96px]">
            Hier ist der Vibe leer.
          </h1>
          <p className="pv-lead">Die Seite gibt es nicht mehr oder der Link ist falsch.</p>
          <form
            action="/search"
            method="get"
            role="search"
            className="mt-3 flex w-full max-w-[520px] flex-col gap-[6px] text-left"
          >
            <label htmlFor="suche-404" className="pv-form-label">
              Wonach suchst du?
            </label>
            <div className="pv-search-row">
              <input
                id="suche-404"
                name="q"
                type="search"
                placeholder="Sorte, Bundle oder Thema"
                autoComplete="off"
                className="pv-input pv-search-input"
              />
              <button type="submit" className="pv-btn-primary flex-none">
                Suchen
              </button>
            </div>
          </form>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            <SiteLink href="/" className="pv-btn-primary">
              Zur Startseite
            </SiteLink>
            <SiteLink href="/pages/shop" className="pv-btn-secondary !bg-cream">
              Zum Shop
            </SiteLink>
          </div>
        </div>
      </section>
      <WaveCut />

      {flavors.length > 0 ? (
        <section
          className="pv-container pv-before-footer flex flex-col gap-4 pt-8 lg:items-center lg:pt-14"
          aria-labelledby="sorten-404"
        >
          <Eyebrow>Unsere Sorten</Eyebrow>
          <h2 id="sorten-404" className="pv-h2 mb-4">
            Such dir deinen Vibe.
          </h2>
          <div className="w-full">
            <FlavorTeaserCards flavors={flavors} />
          </div>
        </section>
      ) : (
        <div className="pv-before-footer" />
      )}
    </SiteShell>
  );
}
