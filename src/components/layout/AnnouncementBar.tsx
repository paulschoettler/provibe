"use client";

import { useEffect, useState } from "react";

/** Anzeigedauer einer Meldung in Millisekunden. */
const ROTATE_MS = 5000;

/**
 * Announcement-Bar mit rotierenden Meldungen (wie im alten Shop).
 *
 * Alle Meldungen stehen im Server-HTML. Genau eine trägt data-active und ist
 * sichtbar, alle anderen sind per CSS `visibility: hidden` und `aria-hidden`.
 * Ohne JavaScript bleibt es bei der ersten. Mit JavaScript wechseln sie alle
 * 5 Sekunden per kurzem Crossfade (globals.css, Block B): Die alte Meldung ist
 * nach 240 ms weg, die neue beginnt erst nach 120 ms, beide zusammen also nie
 * länger als 120 ms und nie beide voll deckend.
 *
 * aria-live ist bewusst aus: der Wechsel ist rein dekorativ und soll
 * Screenreader nicht unterbrechen. In einem Hintergrund-Tab ruht die Rotation.
 */
export function AnnouncementBar({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);
  const count = messages.length;

  useEffect(() => {
    if (count < 2) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setIndex((current) => (current + 1) % count);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [count]);

  if (count === 0) return null;
  // Schrumpft die Liste zwischen zwei Renderings, bleibt trotzdem genau eine aktiv.
  const active = index < count ? index : 0;

  return (
    <div className="pv-announce" aria-live="off">
      <div className="pv-announce-track">
        {messages.map((message, i) => (
          <p
            key={`${i}:${message}`}
            className="pv-announce-item"
            data-active={i === active ? "" : undefined}
            aria-hidden={i === active ? undefined : true}
          >
            {message}
          </p>
        ))}
      </div>
    </div>
  );
}

export default AnnouncementBar;
