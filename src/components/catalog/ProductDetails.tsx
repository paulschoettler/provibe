import type { NutritionTable, ProductDetail } from "@/lib/catalog/products";
import { formatEur } from "@/lib/money";
import { ChevronIcon } from "./icons";
import { Eyebrow } from "./parts";

/**
 * Produktinfos unter dem Kaufbereich (Figma 35:11154): Akkordeons Zutaten, Nährwerte je 100 ml,
 * Lagerung und Hersteller (LMIV) sowie FAQ. Akkordeons sind native <details>-Elemente:
 * Tastatur, Screenreader und Funktion ohne JavaScript inklusive. Die LMIV-Abschnitte sind
 * standardmäßig geöffnet, damit die Pflichtangaben vor dem Kauf sofort sichtbar sind.
 */

export function Accordion({
  title,
  children,
  open = false,
  headingLevel = 3,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <details className="pvc-acc" open={open}>
      <summary>
        <H className="text-inherit">{title}</H>
        <ChevronIcon className="h-5 w-5" />
      </summary>
      <div className="pvc-acc-body">{children}</div>
    </details>
  );
}

export function NutritionTableView({ table, caption }: { table: NutritionTable; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="pvc-nutrition">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Nährwerte</th>
            {table.columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr
              key={row.label}
              className={
                [row.indent ? "is-indent" : "", row.strong ? "is-strong" : ""].join(" ").trim() ||
                undefined
              }
            >
              <th scope="row">{row.label}</th>
              {row.values.map((v, i) => (
                <td key={i}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p>
      <strong className="font-bold">{label}:</strong> {children}
    </p>
  );
}

/** Zutaten, Nährwerte, Lagerung und Hersteller. Bei Bundles mit den Angaben der Sorten. */
export function LmivSections({ product }: { product: ProductDetail }) {
  const isBundle = product.type === "bundle";
  const hasIngredients = isBundle ? product.componentFoods.length > 0 : !!product.ingredientsHtml;
  if (!hasIngredients && !product.nutrition && !product.foodBusinessOperator) return null;

  const claims = [
    "Nährwertangaben je 100 ml.",
    [
      product.stickers.includes("Laktosefrei") ? "Laktosefrei" : null,
      product.stickers.includes("Ohne Zucker") ? "ohne Zucker" : null,
      product.foodName?.includes("Süßungsmittel") ? "mit Süßungsmittel" : null,
    ]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join(" ");
  const depositPerCan =
    product.type === "bundle"
      ? (product.bundleComponents.find((c) => c.kind === "dose")?.depositCentsPerUnit ?? 0)
      : product.defaultVariant.depositPerUnitCents;

  return (
    <section aria-labelledby="produktinfos" className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
      <Eyebrow>Produktinfos</Eyebrow>
      <h2 id="produktinfos" className="sr-only">
        Produktinfos
      </h2>
      <div className="mt-2">
        {hasIngredients ? (
          <Accordion title={isBundle ? "Zutaten der Sorten" : "Zutaten"} open>
            <div className="pvc-richtext max-w-[780px]">
              {isBundle ? (
                product.componentFoods.map((f) => (
                  <div key={f.handle} className="mb-3">
                    <p className="font-bold">{f.name}</p>
                    {f.ingredientsHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: f.ingredientsHtml }} />
                    ) : null}
                  </div>
                ))
              ) : (
                <div dangerouslySetInnerHTML={{ __html: product.ingredientsHtml ?? "" }} />
              )}
              {product.allergens ? (
                <p className="mt-3">
                  <strong className="font-bold">Allergene:</strong> {product.allergens}
                </p>
              ) : null}
            </div>
          </Accordion>
        ) : null}

        {product.nutrition ? (
          <Accordion title={`Nährwerte je ${product.nutrition.per}`} open>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,600px)_1fr] lg:gap-10">
              <NutritionTableView
                table={product.nutrition}
                caption={`Nährwerte je ${product.nutrition.per}`}
              />
              <div>
                {product.proteinPerUnitG && product.netContentText ? (
                  <p className="text-pv-wildberry text-[20px] leading-[1.3] font-bold lg:mt-4 lg:text-[24px]">
                    Je Dose ({product.netContentText}):{" "}
                    {product.proteinPerUnitG.toLocaleString("de-DE")} g Eiweiß.
                  </p>
                ) : null}
                <p className="mt-1.5 text-[13px] leading-[1.45]">{claims}</p>
              </div>
            </div>
          </Accordion>
        ) : null}

        {product.foodBusinessOperator || product.storageInstructions ? (
          <Accordion title="Lagerung und Hersteller" open>
            <div className="flex flex-col gap-2">
              {product.foodName ? <Fact label="Bezeichnung">{product.foodName}</Fact> : null}
              {product.netContentText ? (
                <Fact label="Füllmenge">{product.netContentText} je Dose</Fact>
              ) : null}
              {depositPerCan > 0 ? (
                <Fact label="Pfand">{formatEur(depositPerCan)} je Dose</Fact>
              ) : null}
              {product.foodBusinessOperator ? (
                <Fact label="Lebensmittelunternehmer">{product.foodBusinessOperator}</Fact>
              ) : null}
              {product.countryOfOrigin ? (
                <Fact label="Herkunftsland">{product.countryOfOrigin}</Fact>
              ) : null}
              {product.storageInstructions ? (
                <Fact label="Lagerung">{product.storageInstructions}</Fact>
              ) : null}
            </div>
          </Accordion>
        ) : null}
      </div>
    </section>
  );
}

export function FaqSection({ faq }: { faq: { q: string; a: string }[] }) {
  if (faq.length === 0) return null;
  return (
    <section aria-labelledby="fragen" className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
      <Eyebrow>Fragen</Eyebrow>
      <h2 id="fragen" className="pvc-h2 mt-3 mb-2">
        Gut zu wissen
      </h2>
      {faq.map((f, i) => (
        <Accordion key={f.q} title={f.q} open={i === 0}>
          <p className="max-w-[780px]">{f.a}</p>
        </Accordion>
      ))}
    </section>
  );
}
