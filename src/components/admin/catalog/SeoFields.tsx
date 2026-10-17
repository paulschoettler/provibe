"use client";

import { useEffect, useRef, useState } from "react";
import { useActionFormState } from "@/components/admin/ui/ActionForm";
import { Field, Textarea } from "@/components/admin/ui/fields";

/**
 * SEO-Titel und Meta-Beschreibung mit Zeichenzähler und Vorschau des Suchergebnisses
 * (Figma Produkt-Editor, Karte Suchmaschinen). Leere Felder fallen wie in der Storefront auf
 * Titel und Beschreibung zurück. Die Vorschau liest Titel und Handle live aus dem Formular.
 */
const TITLE_MAX = 60;
const DESC_MAX = 160;

function plain(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function SeoFields({
  titleName = "seo.title",
  descriptionName = "seo.description",
  defaultTitle,
  defaultDescription,
  fallbackTitle,
  fallbackDescription,
  pathPrefix,
  handle,
  disabled,
  titleSuffix = " | PROVIBE",
}: {
  titleName?: string;
  descriptionName?: string;
  defaultTitle: string;
  defaultDescription: string;
  fallbackTitle: string;
  fallbackDescription: string;
  /** "products" oder "collections" */
  pathPrefix: string;
  handle: string;
  disabled?: boolean;
  titleSuffix?: string;
}) {
  const state = useActionFormState();
  const pick = (name: string, d: string) =>
    state.status === "error" && state.values && name in state.values ? state.values[name] : d;
  const [title, setTitle] = useState(pick(titleName, defaultTitle));
  const [desc, setDesc] = useState(pick(descriptionName, defaultDescription));
  const [live, setLive] = useState({
    title: fallbackTitle,
    description: plain(fallbackDescription),
    handle,
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = ref.current?.querySelector("input")?.form;
    if (!form) return;
    const read = () => {
      const get = (n: string) =>
        (form.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement | null)?.value;
      setTitle(get(titleName) ?? "");
      setDesc(get(descriptionName) ?? "");
      setLive({
        title: get("title") || fallbackTitle,
        description: plain(get("descriptionHtml") ?? fallbackDescription),
        handle: get("handle") || handle,
      });
    };
    form.addEventListener("input", read);
    form.addEventListener("reset", () => requestAnimationFrame(read));
    return () => form.removeEventListener("input", read);
  }, [titleName, descriptionName, fallbackTitle, fallbackDescription, handle]);

  const shownTitle = title || `${live.title}${titleSuffix}`;
  const shownDesc = desc || live.description;
  const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  return (
    <div ref={ref} className="flex flex-col gap-4">
      <div className="rounded-admin-feld bg-admin-flaeche p-4" aria-label="Vorschau in der Suche">
        <p className="text-admin-text-2 truncate text-[12px]">
          provibe-drinks.de › {pathPrefix} › {live.handle || "…"}
        </p>
        <p className="mt-1 truncate text-[17px] leading-snug font-medium text-[#1a5fb4]">
          {cut(shownTitle, 70)}
        </p>
        <p className="text-admin-text-2 mt-1 line-clamp-2 text-[13px]">
          {cut(shownDesc, 170) || "Noch keine Beschreibung."}
        </p>
      </div>
      <Field
        name={titleName}
        label="SEO-Titel"
        defaultValue={pick(titleName, defaultTitle)}
        disabled={disabled}
        maxLength={120}
        placeholder={`${fallbackTitle}${titleSuffix}`}
        onChange={(e) => setTitle(e.currentTarget.value)}
        hint={
          <span className={title.length > TITLE_MAX ? "text-admin-gelb-text" : undefined}>
            {title.length} von {TITLE_MAX} Zeichen
            {title.length > TITLE_MAX ? ", wird in Suchergebnissen gekürzt" : ""}
          </span>
        }
      />
      <Textarea
        name={descriptionName}
        label="Meta-Beschreibung"
        defaultValue={pick(descriptionName, defaultDescription)}
        disabled={disabled}
        rows={3}
        maxLength={320}
        onChange={(e) => setDesc(e.currentTarget.value)}
        hint={
          <span className={desc.length > DESC_MAX ? "text-admin-gelb-text" : undefined}>
            {desc.length} von {DESC_MAX} Zeichen
            {desc.length > DESC_MAX ? ", wird gekürzt" : ""}
          </span>
        }
      />
    </div>
  );
}
