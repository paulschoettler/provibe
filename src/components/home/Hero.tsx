import Link from "next/link";
import type { HomeFlavor } from "@/lib/catalog/home";
import HeroExperience from "./HeroExperience";

/**
 * Hero und Scroll-Sequenz der Startseite (Arbeitspaket A), reine Server Component.
 *
 * Aufbau: eine Sektion #pv-hero mit 400vh Höhe, darin ein klebender Bühnenbereich
 * #pv-sequence mit 100svh. Das Scrollen durch die Sektion treibt --seq von 0 auf 1:
 * 0 bis 0,3 blenden Sortenname, Noten, Punkte und "Scrollen" aus, ab 0,4 blendet der
 * Zutatenblock ein, die Pfeile bleiben durchgehend sichtbar und schaltbar.
 *
 * Alle Texte aller Sorten stehen im HTML, nur die aktive ist sichtbar
 * (data-active). Ohne JavaScript bleibt die Sektion auf natürlicher Höhe und
 * zeigt Dose, Sortenname und Zutaten untereinander.
 *
 * Schichten (z-index): Verlauf 0, 3D-Canvas 1, Bühne 2, Warenkorb-Button 30.
 */

/** Beschriftung der Nährwertschlüssel aus product_translations.nutrition. */
const NUTRITION_LABELS: Record<string, string> = {
  energy: "Energie",
  fat_g: "Fett",
  saturated_fat_g: "davon gesättigte Fettsäuren",
  carbs_g: "Kohlenhydrate",
  sugar_g: "davon Zucker",
  fibre_g: "Ballaststoffe",
  protein_g: "Eiweiß",
  salt_g: "Salz",
};

/** Reihenfolge nach LMIV Anhang XV. JSONB liefert die Schlüssel unsortiert. */
const NUTRITION_ORDER = [
  "energy",
  "fat_g",
  "saturated_fat_g",
  "carbs_g",
  "sugar_g",
  "fibre_g",
  "protein_g",
  "salt_g",
];

function nutritionLabel(key: string): string {
  return NUTRITION_LABELS[key] ?? key.replace(/_/g, " ");
}

function nutritionUnit(key: string): string {
  if (key.endsWith("_g")) return "g";
  if (key.endsWith("_mg")) return "mg";
  return "";
}

interface NutritionRow {
  key: string;
  label: string;
  value: string;
}

/**
 * Nährwerte in Zeilen umwandeln. "per" wird zur Überschrift, Energie kommt als
 * eine Zeile "kJ / kcal", der Rest folgt der LMIV-Reihenfolge.
 */
function nutritionRows(nutrition: HomeFlavor["nutrition"]): { per: string; rows: NutritionRow[] } {
  if (!nutrition) return { per: "100 ml", rows: [] };
  const per = typeof nutrition.per === "string" ? nutrition.per : "100 ml";
  const rows: NutritionRow[] = [];

  const energy: string[] = [];
  if (nutrition.energy_kj !== undefined && nutrition.energy_kj !== null) {
    energy.push(`${nutrition.energy_kj} kJ`);
  }
  if (nutrition.energy_kcal !== undefined && nutrition.energy_kcal !== null) {
    energy.push(`${nutrition.energy_kcal} kcal`);
  }
  if (energy.length > 0) rows.push({ key: "energy", label: "Energie", value: energy.join(" / ") });

  for (const [key, raw] of Object.entries(nutrition)) {
    if (key === "per" || key === "energy_kj" || key === "energy_kcal") continue;
    if (raw === null || raw === undefined || typeof raw === "object") continue;
    const unit = nutritionUnit(key);
    rows.push({ key, label: nutritionLabel(key), value: unit ? `${raw} ${unit}` : String(raw) });
  }

  const rank = (key: string) => {
    const index = NUTRITION_ORDER.indexOf(key);
    return index === -1 ? NUTRITION_ORDER.length : index;
  };
  rows.sort((a, b) => rank(a.key) - rank(b.key));
  return { per, rows };
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  const path = direction === "left" ? "M14.5 5 8 12l6.5 7" : "M9.5 5 16 12l-6.5 7";
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Hero({ flavors }: { flavors: HomeFlavor[] }) {
  if (flavors.length === 0) return null;
  const count = flavors.length;

  return (
    <section id="pv-hero" className="pv-hero">
      <a className="pv-skip sr-only-focusable" href="#pvshop">
        Zum Inhalt
      </a>

      {/* Sortenfläche: klebt hinter der 3D-Canvas, Farben kommen aus --flavor-* */}
      <div className="pv-hero__bg" aria-hidden="true">
        <div className="pv-hero__bg-fill" />
      </div>

      <div id="pv-sequence" className="pv-stage">
        {/* Freigestellte Dosen als Server-HTML. Sie bleiben sichtbar, bis das
            passende 3D-Modell geladen ist, und sind der dauerhafte Fallback
            ohne WebGL (G11: kein Loader). */}
        <div className="pv-cans" aria-hidden="true">
          {flavors.map((flavor, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={flavor.slug}
              className="pv-can"
              data-pv-flavor={index}
              data-active={index === 0 ? "true" : "false"}
              src={flavor.imageUrl}
              alt=""
              width={405}
              height={760}
              decoding="async"
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "low"}
            />
          ))}
        </div>

        <div className="pv-stage__top">
          <Link className="pv-hero__logo" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/brand/logo-wine.png" alt="provibe" width={1000} height={297} />
          </Link>
          <h1 className="pv-h1">Eistee mit 15 g Protein</h1>
        </div>

        <button
          className="pv-arrow pv-arrow--prev"
          type="button"
          data-pv-prev
          aria-label="Vorherige Sorte"
        >
          <Chevron direction="left" />
        </button>
        <button
          className="pv-arrow pv-arrow--next"
          type="button"
          data-pv-next
          aria-label="Nächste Sorte"
        >
          <Chevron direction="right" />
        </button>

        <div className="pv-stage__bottom">
          <div className="pv-names" aria-live="polite" aria-atomic="true">
            {flavors.map((flavor, index) => (
              <div
                key={flavor.slug}
                className="pv-names__item"
                data-pv-flavor={index}
                data-active={index === 0 ? "true" : "false"}
              >
                <p className="pv-names__title">{flavor.shortName}</p>
                {flavor.notes ? <p className="pv-names__notes">{flavor.notes}</p> : null}
              </div>
            ))}
          </div>

          <div className="pv-dots" role="group" aria-label="Sorte wählen">
            {flavors.map((flavor, index) => (
              <button
                key={flavor.slug}
                className="pv-dot"
                type="button"
                data-pv-dot={index}
                aria-label={`Sorte ${index + 1} von ${count}: ${flavor.shortName}`}
                aria-current={index === 0 ? "true" : undefined}
              >
                <span className="pv-dot__mark" aria-hidden="true" />
              </button>
            ))}
          </div>

          <p className="pv-scrollhint">
            <span>Scrollen</span>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path
                d="M12 5v13m0 0 5-5m-5 5-5-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </p>
        </div>

        {/* Zutaten und Nährwerte: alle Sorten im HTML, eingeblendet ab --seq 0,4 */}
        <div className="pv-facts">
          {flavors.map((flavor, index) => {
            const { per, rows } = nutritionRows(flavor.nutrition);
            return (
              <article
                key={flavor.slug}
                className="pv-facts__item"
                data-pv-flavor={index}
                data-active={index === 0 ? "true" : "false"}
              >
                <h2 className="pv-facts__title pv-rise">{flavor.title}</h2>

                {flavor.badges.length > 0 ? (
                  <ul className="pv-badges pv-rise">
                    {flavor.badges.map((badge) => (
                      <li key={badge} className="pv-badge">
                        {badge}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {flavor.ingredientsHtml ? (
                  <div className="pv-rise">
                    <h3 className="pv-facts__label">Zutaten</h3>
                    <div
                      className="pv-ingredients"
                      dangerouslySetInnerHTML={{ __html: flavor.ingredientsHtml }}
                    />
                  </div>
                ) : null}

                {flavor.allergens ? (
                  <p className="pv-allergens pv-rise">
                    <strong>Allergene:</strong> {flavor.allergens}
                  </p>
                ) : null}

                {rows.length > 0 ? (
                  <div className="pv-rise">
                    <h3 className="pv-facts__label">Nährwerte je {per}</h3>
                    <dl className="pv-nutrition">
                      {rows.map((row) => (
                        <div key={row.key} className="pv-nutrition__row">
                          <dt>{row.label}</dt>
                          <dd>{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}

                <p className="pv-rise">
                  <a className="link-underline" href={flavor.productUrl}>
                    Alle Details
                  </a>
                </p>
              </article>
            );
          })}
        </div>
      </div>

      <HeroExperience
        flavors={flavors.map((flavor) => ({
          slug: flavor.slug,
          shortName: flavor.shortName,
          palette: flavor.palette,
        }))}
      />
    </section>
  );
}
