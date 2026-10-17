"use client";

import { useEffect, useRef } from "react";
import type { TrackingEvent } from "@/lib/tracking/schema";
import { track } from "./track";

/**
 * Sendet ein serverseitig gebautes Event einmal beim Anzeigen (view_item auf Produktseiten,
 * view_item_list in Kollektionen, search auf /search). Rendert nichts; der Inhalt der Seite steht
 * unabhängig davon vollständig im Server-HTML.
 */
export function TrackEvent({ event }: { event: TrackingEvent }) {
  const key = JSON.stringify(event);
  const sentFor = useRef<string | null>(null);

  useEffect(() => {
    if (sentFor.current === key) return;
    // Einen Takt später, damit page_view der Seite zuerst gezählt wird
    const timer = window.setTimeout(() => {
      sentFor.current = key;
      track(JSON.parse(key) as TrackingEvent);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key]);

  return null;
}

export default TrackEvent;
