import { Fragment } from "react";

const WORDS = ["WILDBERRY", "RASPBERRY LIME", "PEACH", "15 G PROTEIN"] as const;

/** Eine Gruppe enthält die Wortfolge zweimal, damit sie breiter ist als jeder Bildschirm. */
function Group() {
  return (
    <span className="finale-marquee__group">
      {[0, 1].map((round) => (
        <Fragment key={round}>
          {WORDS.map((word) => (
            <Fragment key={`${round}-${word}`}>
              <span className="finale-marquee__word">{word}</span>
              <span className="finale-marquee__dot" />
            </Fragment>
          ))}
        </Fragment>
      ))}
    </span>
  );
}

/**
 * Schräges Laufband mit den Sortennamen (Butter, Aubergine-Kontur). Rein dekorativ,
 * deshalb aria-hidden. Der Inhalt steht doppelt, die CSS-Animation schiebt die Spur
 * in 28 s um die Hälfte nach links und beginnt nahtlos von vorn. Ohne JavaScript und
 * bei reduzierter Bewegung steht das Band still.
 */
export function FinaleMarquee() {
  return (
    <div className="finale-marquee" aria-hidden="true">
      <div className="finale-marquee__band">
        <div className="finale-marquee__track">
          <Group />
          <Group />
        </div>
      </div>
    </div>
  );
}

export default FinaleMarquee;
