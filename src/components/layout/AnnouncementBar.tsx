"use client";

import { useEffect, useState } from "react";

/**
 * Announcement-Bar mit rotierenden Meldungen (wie im alten Shop).
 *
 * Alle Meldungen stehen im Server-HTML. Ohne JavaScript ist die erste sichtbar,
 * mit JavaScript wechseln sie alle 5 Sekunden. aria-live ist bewusst aus: der Wechsel
 * ist rein dekorativ und soll Screenreader nicht unterbrechen.
 */
export function AnnouncementBar({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [messages.length]);

  if (messages.length === 0) return null;

  return (
    <div className="pv-announce" aria-live="off">
      <div className="pv-announce-track">
        {messages.map((message, i) => (
          <p key={message} className="pv-announce-item" data-active={i === index ? "" : undefined}>
            {message}
          </p>
        ))}
      </div>
    </div>
  );
}

export default AnnouncementBar;
