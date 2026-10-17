import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env/public";
import type { Database } from "@/lib/supabase/database.types";
import { htmlToText, listProducts, type CatalogProduct } from "./products";

/**
 * Servergerenderte Suche über Produkte und Seiten (Paket Katalog).
 *
 * Grundlage ist die SQL-Funktion public.search_storefront(p_query, p_locale, p_limit)
 * (Migration 20260921121000_content.sql, SECURITY INVOKER seit 20260921121600). Sie liefert
 * Zeilen (kind 'product' | 'page', id, handle, title, subtitle, rank) für ALLE aktiven Produkte
 * und indexierbaren Seiten, auch mit rank 0. Deshalb filtert diese Datei nach einer Mindest-
 * relevanz. Rechtstexte liegen nicht in pages, sie kommen als feste Einträge dazu.
 */

/** Ab dieser Relevanz zählt ein Treffer (Trigramm-Ähnlichkeit unter 0,2 ist Rauschen). */
export const MIN_RANK = 0.2;
export const MAX_QUERY_LENGTH = 80;
export const SEARCH_SUGGESTIONS = ["Wildberry", "Peach", "Bundles", "Versand"];

export interface SearchPageHit {
  title: string;
  url: string;
  /** Ausschnitt als Text mit Markierung: Teile mit mark=true sind der Suchbegriff */
  snippet: { text: string; mark: boolean }[];
}

export interface SearchResult {
  query: string;
  products: CatalogProduct[];
  pages: SearchPageHit[];
  total: number;
}

/** Feste Seiten, die nicht in der Tabelle pages stehen (Rechtstexte und Versand). */
export const STATIC_PAGES: { title: string; url: string; keywords: string[]; text: string }[] = [
  {
    title: "Versand und Zahlung",
    url: "/pages/versand",
    keywords: [
      "versand",
      "lieferung",
      "lieferzeit",
      "versandkosten",
      "zahlung",
      "zahlarten",
      "paypal",
      "klarna",
    ],
    text: "Versand 4,90 € pro Bestellung, ab 50 € versandkostenfrei. Lieferung innerhalb Deutschlands in 3 bis 5 Werktagen.",
  },
  {
    title: "Widerrufsbelehrung",
    url: "/pages/ruckgabe-und-wiederrufsbelehrung",
    keywords: ["widerruf", "rückgabe", "retoure", "zurückschicken", "umtausch"],
    text: "Widerrufsbelehrung mit Muster-Widerrufsformular. Du kannst deinen Vertrag auch elektronisch widerrufen.",
  },
  {
    title: "Vertrag widerrufen",
    url: "/pages/widerruf-formular",
    keywords: ["widerruf", "widerrufen", "kündigen", "formular"],
    text: "Elektronische Widerrufsfunktion: Vertrag widerrufen, mit Eingangsbestätigung per E-Mail.",
  },
  {
    title: "AGB",
    url: "/pages/allgemeine-geschaftsbedingungen",
    keywords: ["agb", "geschäftsbedingungen", "bedingungen"],
    text: "Allgemeine Geschäftsbedingungen für Bestellungen im provibe Shop.",
  },
  {
    title: "Impressum",
    url: "/pages/impressum",
    keywords: ["impressum", "kontakt", "anschrift", "adresse"],
    text: "Impressum mit Anschrift und Kontaktdaten.",
  },
  {
    title: "Datenschutzerklärung",
    url: "/policies/privacy-policy",
    keywords: ["datenschutz", "cookies", "privacy", "daten"],
    text: "Datenschutzerklärung: welche Daten wir verarbeiten und welche Rechte du hast.",
  },
];

/** Gebräuchliche deutsche Begriffe auf die Produktnamen abbilden. */
const SYNONYMS: Record<string, string> = {
  pfirsich: "peach",
  himbeere: "raspberry",
  himbeer: "raspberry",
  limette: "lime",
  beere: "wildberry",
  beeren: "wildberry",
  bundles: "bundle",
  set: "bundle",
  sets: "bundle",
  becher: "cup",
  trinkbecher: "cup",
  tshirt: "shirt",
  "t-shirt": "shirt",
  mix: "mixed",
};

/** Suchbegriff bereinigen: Leerraum zusammenfassen, Länge begrenzen. */
export function normalizeQuery(input: string | string[] | undefined): string {
  const raw = Array.isArray(input) ? (input[0] ?? "") : (input ?? "");
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

/** Begriff, der an die Datenbank geht (Synonyme ersetzt, LIKE-Platzhalter entschärft). */
export function databaseQuery(query: string): string {
  const lower = query
    .toLowerCase()
    .replace(/[%_\\]/g, " ")
    .trim();
  return SYNONYMS[lower] ?? lower;
}

/**
 * Textausschnitt um den ersten Treffer herum, in Teile zerlegt, damit die Markierung ohne
 * dangerouslySetInnerHTML gerendert werden kann.
 */
export function buildSnippet(text: string, query: string, radius = 70): SearchPageHit["snippet"] {
  const clean = text
    // Markdown-Reste aus dem Shopify-Import: [Text](/pfad) → Text, Überschriften-Rauten weg
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(^|\s)#{1,6}\s/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return [];
  const terms = [query, databaseQuery(query)].filter((t) => t.length > 1);
  const lower = clean.toLowerCase();
  let index = -1;
  let term = "";
  for (const t of terms) {
    index = lower.indexOf(t.toLowerCase());
    if (index >= 0) {
      term = t;
      break;
    }
  }
  if (index < 0) {
    const head =
      clean.length > radius * 2 ? `${clean.slice(0, radius * 2).replace(/\s+\S*$/, "")} …` : clean;
    return [{ text: head, mark: false }];
  }
  const start = Math.max(0, index - radius);
  const end = Math.min(clean.length, index + term.length + radius);
  const before =
    (start > 0 ? "… " : "") + clean.slice(start, index).replace(/^\S*\s/, start > 0 ? "" : "$&");
  const after = clean.slice(index + term.length, end) + (end < clean.length ? " …" : "");
  return [
    { text: before, mark: false },
    { text: clean.slice(index, index + term.length), mark: true },
    { text: after, mark: false },
  ].filter((p) => p.text.length > 0);
}

/** Feste Seiten, deren Titel oder Schlagworte zum Begriff passen. */
export function matchStaticPages(query: string): SearchPageHit[] {
  const q = databaseQuery(query);
  if (q.length < 2) return [];
  return STATIC_PAGES.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.keywords.some((k) => k.startsWith(q) || q.startsWith(k)),
  ).map((p) => ({ title: p.title, url: p.url, snippet: buildSnippet(p.text, query) }));
}

function searchDb() {
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

/** Suche ausführen. Leerer Begriff liefert ein leeres Ergebnis ohne Datenbankabfrage. */
export async function searchStorefront(input: string, locale = "de"): Promise<SearchResult> {
  const query = normalizeQuery(input);
  if (query.length < 2) return { query, products: [], pages: [], total: 0 };

  const db = searchDb();
  const { data, error } = await db.rpc("search_storefront", {
    p_query: databaseQuery(query),
    p_locale: locale,
    p_limit: 40,
  });
  const rows = error ? [] : (data ?? []).filter((r) => r.rank >= MIN_RANK);

  const productHandles = rows.filter((r) => r.kind === "product").map((r) => r.handle);
  const allProducts = productHandles.length ? await listProducts({ locale }) : [];
  const products = productHandles
    .map((h) => allProducts.find((p) => p.handle === h))
    .filter((p): p is CatalogProduct => !!p);

  const pageRows = rows.filter((r) => r.kind === "page");
  let pages: SearchPageHit[] = [];
  if (pageRows.length) {
    const { data: bodies } = await db
      .from("page_translations")
      .select("page_id, title, body_html")
      .eq("locale", locale)
      .in(
        "page_id",
        pageRows.map((r) => r.id),
      );
    pages = pageRows.map((r) => {
      const body = bodies?.find((b) => b.page_id === r.id);
      return {
        title: r.title,
        url: `/pages/${r.handle}`,
        snippet: buildSnippet(htmlToText(body?.body_html ?? ""), query),
      };
    });
  }
  for (const hit of matchStaticPages(query)) {
    if (!pages.some((p) => p.url === hit.url)) pages.push(hit);
  }

  return { query, products, pages, total: products.length + pages.length };
}
