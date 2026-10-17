import Link from "next/link";
import type { HomeFlavor } from "@/lib/catalog/home";
import HeroExperience from "./HeroExperience";
import HeroBackdrop from "./hero/HeroBackdrop";
import HeroDeco from "./hero/HeroDeco";
import { CanSilhouette, Chevron } from "./hero/HeroIcons";
import { nutritionRows } from "./hero/nutrition";

/**
 * Hero und Scroll-Sequenz der Startseite (Arbeitspaket A, Figma-Richtung A "Vibe"),
 * reine Server Component.
 *
 * Aufbau: eine Sektion #pv-hero mit 400vh Höhe, darin ein klebender Bühnenbereich
 * #pv-sequence mit 100svh. Das Scrollen durch die Sektion treibt --seq von 0 auf 1:
 * 0 bis 0,3 blenden Riesentypo, Sticker, Wellenband und "Scrollen" aus, ab 0,4
 * blendet das Zutatenpanel ein, die Pfeile bleiben durchgehend sichtbar und schaltbar.
 *
 * Alle Texte aller Sorten stehen im HTML, nur die aktive ist sichtbar
 * (data-active). Ohne JavaScript bleibt die Sektion auf natürlicher Höhe und
 * zeigt Dose, Sortenname und Zutaten untereinander.
 *
 * Schichten (z-index): Hintergrund -1 (Verlauf, Blobs, Wellenband, hintere Zeile
 * der Riesentypo), 3D-Canvas 0, Bühne 2 (vordere Zeile, Sticker, Bedienelemente,
 * Zutaten), Warenkorb-Dock 30. Dadurch steht die erste Zeile hinter der Dose und
 * die zweite davor.
 */

/** Art eines Badges, steuert die Sticker-Farbe im Zutatenpanel. */
function badgeKind(badge: string): string {
  const text = badge.toLowerCase();
  if (text.includes("protein")) return "protein";
  if (text.includes("zucker")) return "sugar";
  if (text.includes("laktose")) return "lactose";
  return "plain";
}

/**
 * "15 g Protein" wird als Sticker zweizeilig gesetzt (Wert groß, Wort klein).
 * Der Text bleibt dabei derselbe, nur in zwei Spannen.
 */
function BadgeText({ badge }: { badge: string }) {
  const match = /^(.*\d.*?)\s+(Protein)$/i.exec(badge);
  if (!match) return <>{badge}</>;
  return (
    <>
      <span className="pv-badge__value">{match[1]}</span>{" "}
      <span className="pv-badge__label">{match[2]}</span>
    </>
  );
}

export default function Hero({ flavors }: { flavors: HomeFlavor[] }) {
  if (flavors.length === 0) return null;
  const count = flavors.length;

  return (
    <section id="pv-hero" className="pv-hero" data-flavor-index="0">
      <a className="pv-skip sr-only-focusable" href="#pvshop">
        Zum Inhalt
      </a>

      {/* Hintergrund: klebt unter der 3D-Canvas, Farben kommen aus --flavor-* */}
      <div className="pv-hero__bg" aria-hidden="true">
        <HeroBackdrop flavors={flavors} />
      </div>

      <div id="pv-sequence" className="pv-stage">
        {/* Freigestellte Dosen als Server-HTML: eine vorn, je eine links und rechts.
            Sie bleiben sichtbar, bis die 3D-Szene die aktive Sorte gerendert hat,
            und sind der dauerhafte Fallback ohne WebGL (G11: kein Loader).
            data-pos hält dieselbe Anordnung wie der Ring der 3D-Szene. */}
        <div className="pv-cans" aria-hidden="true">
          {flavors.map((flavor, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={flavor.slug}
              className="pv-can"
              data-pv-flavor={index}
              data-active={index === 0 ? "true" : "false"}
              data-pos={index === 0 ? "active" : index === 1 ? "next" : "prev"}
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

        <HeroDeco flavors={flavors} />

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
          {/* Der Sortenname steht als echter Text hier (für Screenreader angesagt),
              sichtbar ist er als Riesentypo. Die Noten stehen im Wellenband. */}
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

          <p className="pv-scrollhint">
            <span>Scrollen</span>
            <Chevron direction="down" size={18} />
          </p>
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
              <CanSilhouette />
            </button>
          ))}
        </div>

        {/* Zutatenpanel: alle Sorten im HTML, eingeblendet ab --seq 0,4 */}
        {/* Fläche und Scrollbereich sind getrennt: Ein scrollender Block mit
            deckendem Hintergrund verdeckt in Chromium Teile der 3D-Canvas
            (Verdeckungsprüfung des Compositors), ein durchsichtiger nicht.
            Auf dem Telefon scrollt nichts: Dose, Panel und Dock passen
            gemeinsam ins Bild (hero-geometry.ts, data-layout auf #pv-hero). */}
        <div className="pv-facts">
          <div className="pv-facts__scroll">
            {flavors.map((flavor, index) => {
              const { per, rows } = nutritionRows(flavor.nutrition);
              return (
                <article
                  key={flavor.slug}
                  className="pv-facts__item"
                  data-pv-flavor={index}
                  data-active={index === 0 ? "true" : "false"}
                >
                  <div className="pv-facts__head pv-rise">
                    <p className="pv-eyebrow">Was drin ist</p>
                    <a className="pv-more" href={flavor.productUrl}>
                      Alle Details
                      <Chevron direction="right" size={16} />
                    </a>
                  </div>

                  <h2 className="pv-facts__title pv-rise">{flavor.shortName}</h2>
                  {flavor.notes ? <p className="pv-facts__notes pv-rise">{flavor.notes}</p> : null}

                  {flavor.badges.length > 0 ? (
                    <ul className="pv-badges pv-rise">
                      {flavor.badges.map((badge) => (
                        <li key={badge} className="pv-badge" data-kind={badgeKind(badge)}>
                          <BadgeText badge={badge} />
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {flavor.ingredientsHtml || flavor.allergens ? (
                    <div className="pv-facts__text pv-rise">
                      {flavor.ingredientsHtml ? (
                        <div className="pv-ingredients">
                          <h3 className="pv-facts__inline">Zutaten:</h3>
                          <div dangerouslySetInnerHTML={{ __html: flavor.ingredientsHtml }} />
                        </div>
                      ) : null}
                      {flavor.allergens ? (
                        <p className="pv-allergens">
                          <strong>Allergene:</strong> {flavor.allergens}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {rows.length > 0 ? (
                    <div className="pv-rise">
                      <h3 className="pv-facts__label">Nährwerte je {per}</h3>
                      <dl className="pv-nutrition">
                        {rows.map((row) => (
                          <div
                            key={row.key}
                            className="pv-nutrition__row"
                            data-key={row.key}
                            data-featured={row.featured ? "true" : "false"}
                            data-highlight={row.highlight ? "true" : "false"}
                          >
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
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
