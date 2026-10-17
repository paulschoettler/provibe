"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Ziehen zum Sortieren in einer Server-Tabelle (Produktliste nach Position). Die Tabelle bleibt
 * serverseitig gerendert; in jeder Zeile markiert ein Griff [data-drag-id] die Zeile. Dieses
 * Bauteil macht die zugehörigen <tr> ziehbar, zeigt die Einfügestelle und schickt die neue
 * Reihenfolge an die Server Action. Die DOM-Reihenfolge ändert es nicht selbst, das übernimmt
 * das erneute Rendern. Ohne JavaScript bleiben die Buttons "nach oben" und "nach unten".
 */
export function ListSorter({
  containerId,
  action,
}: {
  containerId: string;
  action: (ids: string[]) => Promise<{ ok: boolean; message?: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const drag = useRef<string | null>(null);

  useEffect(() => {
    const root = document.getElementById(containerId);
    if (!root) return;
    const handles = Array.from(root.querySelectorAll<HTMLElement>("table [data-drag-id]"));
    const rows = handles.map((h) => h.closest("tr")).filter((r): r is HTMLTableRowElement => !!r);
    const ids = handles.map((h) => h.dataset.dragId!);
    const cleanups: (() => void)[] = [];
    const clear = () => rows.forEach((r) => r.classList.remove("kat-drop-vor", "kat-drop-nach"));

    rows.forEach((row, i) => {
      row.draggable = true;
      const id = ids[i];
      const onStart = (e: DragEvent) => {
        drag.current = id;
        row.classList.add("kat-zieht");
        e.dataTransfer?.setData("text/plain", id);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      };
      const onEnd = () => {
        drag.current = null;
        row.classList.remove("kat-zieht");
        clear();
      };
      const onOver = (e: DragEvent) => {
        if (!drag.current || drag.current === id) return;
        e.preventDefault();
        const rect = row.getBoundingClientRect();
        clear();
        row.classList.add(
          e.clientY < rect.top + rect.height / 2 ? "kat-drop-vor" : "kat-drop-nach",
        );
      };
      const onDrop = (e: DragEvent) => {
        e.preventDefault();
        const from = drag.current;
        if (!from || from === id) return clear();
        const before = row.classList.contains("kat-drop-vor");
        clear();
        const next = ids.filter((x) => x !== from);
        next.splice(next.indexOf(id) + (before ? 0 : 1), 0, from);
        start(async () => {
          const r = await action(next);
          setMessage(
            r.ok ? "Reihenfolge gespeichert." : (r.message ?? "Speichern fehlgeschlagen."),
          );
          router.refresh();
        });
      };
      row.addEventListener("dragstart", onStart);
      row.addEventListener("dragend", onEnd);
      row.addEventListener("dragover", onOver);
      row.addEventListener("drop", onDrop);
      cleanups.push(() => {
        row.draggable = false;
        row.removeEventListener("dragstart", onStart);
        row.removeEventListener("dragend", onEnd);
        row.removeEventListener("dragover", onOver);
        row.removeEventListener("drop", onDrop);
      });
    });
    return () => cleanups.forEach((c) => c());
  });

  return (
    <p className="text-admin-text-2 px-3 pb-3 text-[12px] max-md:hidden" aria-live="polite">
      {pending
        ? "Reihenfolge wird gespeichert …"
        : (message ?? "Reihenfolge per Ziehen am Griff ändern oder mit den Pfeilen.")}
    </p>
  );
}
