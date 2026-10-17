import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { SiteLink } from "@/components/layout/SiteLink";
import { EmptyState } from "@/components/catalog/EmptyState";
import {
  ArrowRightIcon,
  Blob,
  CloseLineIcon,
  DocumentIcon,
  SearchLineIcon,
} from "@/components/catalog/icons";
import { Eyebrow, PageBand } from "@/components/catalog/parts";
import { ProductCard } from "@/components/catalog/ProductCard";
import { listProducts } from "@/lib/catalog/products";
import {
  normalizeQuery,
  searchStorefront,
  SEARCH_SUGGESTIONS,
  type SearchPageHit,
} from "@/lib/catalog/search";
import Image from "next/image";

/**
 * Suche (Figma 38:3631 mobil, 39:12260 Desktop, leer 38:3850): servergerenderte Ergebnisse aus
 * public.search_storefront, Produktkarten und Seitenzeilen, Vorschläge, Leerzustand.
 * Das Formular ist ein normales GET-Formular auf /search und braucht kein JavaScript.
 * Suchseiten werden nicht indexiert (Briefing Abschnitt 7: robots schließt die Suche aus).
 */
type Search = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const q = normalizeQuery((await searchParams).q);
  return {
    title: q ? `Suche nach „${q}“` : "Suche",
    description: "Durchsuche den provibe Shop nach Sorten, Bundles, Merch und Seiten.",
    alternates: { canonical: "/search" },
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = normalizeQuery((await searchParams).q);
  const [result, popular] = await Promise.all([
    q ? searchStorefront(q) : Promise.resolve(null),
    q ? Promise.resolve([]) : listProducts({ filter: "eistee" }),
  ]);

  return (
    <SiteShell>
      <PageBand innerClassName="max-w-[800px]">
        <Blob
          className="pvc-band-deco top-[-60px] right-[-120px] h-[300px] w-[300px] lg:hidden"
          opacity={0.5}
        />
        <div
          className="pointer-events-none absolute top-[-40px] right-[-260px] hidden h-[340px] w-[340px] lg:block"
          aria-hidden="true"
        >
          <Blob className="text-pink absolute inset-0 h-full w-full" opacity={0.6} />
          <Image
            src="/images/cans/peach.webp"
            alt=""
            width={405}
            height={760}
            sizes="120px"
            className="relative mx-auto mt-4 h-[200px] w-auto rotate-[-18deg] drop-shadow-[0_10px_14px_rgba(74,46,56,0.28)]"
          />
        </div>
        <h1 className="relative text-[44px] leading-none font-bold tracking-[-0.02em] lg:text-center lg:text-[72px]">
          Suche
        </h1>
        <form action="/search" method="get" role="search" className="relative mt-4 lg:mt-6">
          <label htmlFor="suchbegriff" className="mb-2 block text-[15px] font-semibold">
            Wonach suchst du?
          </label>
          <div className="pvc-search-field">
            <SearchLineIcon className="text-aubergine h-5 w-5 shrink-0" />
            <input
              id="suchbegriff"
              name="q"
              type="search"
              defaultValue={q}
              maxLength={80}
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Sorte, Bundle, Thema …"
            />
            {q ? (
              <SiteLink
                href="/search"
                className="text-aubergine grid h-11 w-11 shrink-0 place-items-center rounded-full"
                aria-label="Suchbegriff löschen"
              >
                <CloseLineIcon className="h-5 w-5" />
              </SiteLink>
            ) : null}
            <button type="submit" className="btn-primary min-h-11 shrink-0 px-5 py-2 text-[15px]">
              Suchen
            </button>
          </div>
        </form>
        <Suggestions className="relative mt-4" label="Vorschläge" />
      </PageBand>

      <div className="mx-auto w-full max-w-[1200px] px-4 pt-2 pb-16 sm:px-6 lg:pb-24">
        {result && result.total > 0 ? (
          <>
            <h2 className="text-[22px] font-semibold lg:text-[30px]" aria-live="polite">
              {result.total} {result.total === 1 ? "Ergebnis" : "Ergebnisse"} für „{result.query}“
            </h2>
            <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,740px)_1fr] lg:gap-10">
              {result.products.length ? (
                <section aria-labelledby="treffer-produkte">
                  <div className="mb-4 flex items-center justify-between">
                    <Eyebrow as="h3" id="treffer-produkte">
                      Produkte
                    </Eyebrow>
                    <span className="text-plum text-[14px] font-semibold">
                      {result.products.length}
                    </span>
                  </div>
                  <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                    {result.products.map((p) => (
                      <li key={p.id} className="flex">
                        <ProductCard product={p} layout="compact" headingLevel={3} />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {result.pages.length ? (
                <section
                  aria-labelledby="treffer-seiten"
                  className={result.products.length ? "" : "lg:col-span-2"}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Eyebrow as="h3" id="treffer-seiten">
                      Seiten
                    </Eyebrow>
                    <span className="text-plum text-[14px] font-semibold">
                      {result.pages.length}
                    </span>
                  </div>
                  <ul>
                    {result.pages.map((hit) => (
                      <PageHit key={hit.url} hit={hit} />
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </>
        ) : result ? (
          <EmptyState
            title={`Nichts gefunden zu „${result.query}“`}
            text={<p>Check die Schreibweise oder probier einen dieser Begriffe:</p>}
          >
            <Suggestions className="mt-4 justify-center" />
          </EmptyState>
        ) : (
          <section aria-labelledby="beliebt">
            <Eyebrow>Beliebt</Eyebrow>
            <h2 id="beliebt" className="pvc-h2 mt-3 mb-6">
              Unsere Sorten
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {popular.map((p) => (
                <li key={p.id} className="flex">
                  <ProductCard product={p} layout="compact" headingLevel={3} />
                </li>
              ))}
            </ul>
            <SiteLink
              href="/collections/all"
              className="mt-6 inline-flex min-h-11 items-center gap-1.5 font-semibold underline underline-offset-4"
            >
              Alle Produkte ansehen
              <ArrowRightIcon className="h-4 w-4" />
            </SiteLink>
          </section>
        )}
      </div>
    </SiteShell>
  );
}

function Suggestions({ className = "", label }: { className?: string; label?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {label ? <p className="mr-1 w-full text-[15px] font-semibold sm:w-auto">{label}:</p> : null}
      <ul
        className={`flex flex-wrap gap-2 ${label ? "" : "justify-center"}`}
        aria-label={label ?? "Suchvorschläge"}
      >
        {SEARCH_SUGGESTIONS.map((s) => (
          <li key={s}>
            <SiteLink href={`/search?q=${encodeURIComponent(s)}`} className="pvc-chip">
              {s}
            </SiteLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PageHit({ hit }: { hit: SearchPageHit }) {
  return (
    <li className="border-mauve/40 border-b">
      <SiteLink href={hit.url} className="group flex items-center gap-4 py-5">
        <span className="bg-cream-2 text-aubergine grid h-11 w-11 shrink-0 place-items-center rounded-[14px]">
          <DocumentIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="group-hover:text-berry block text-[18px] font-semibold">
            {hit.title}
          </span>
          <span className="text-plum block text-[13px]">{hit.url}</span>
          <span className="mt-1 block text-[15px] leading-[1.45]">
            {hit.snippet.map((part, i) =>
              part.mark ? (
                <strong key={i} className="font-semibold">
                  {part.text}
                </strong>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )}
          </span>
        </span>
        <ArrowRightIcon className="text-aubergine h-5 w-5 shrink-0" />
      </SiteLink>
    </li>
  );
}
