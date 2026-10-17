/**
 * Formularfelder der Startseiten-Module (homepage_modules.config) und die Rückübersetzung der
 * Formularwerte in JSON. Felder heißen "cfg.<pfad>", Listen "cfg.items.<n>.<feld>", Stichwort-
 * listen werden zeilenweise eingegeben. Unbekannte Schlüssel der bestehenden Konfiguration
 * bleiben erhalten (die Storefront kann mehr Felder kennen als das Formular).
 * Rein, getestet in module-fields.test.ts. Die Prüfung macht parseModuleConfig (homepage.ts).
 */

export type ModuleFieldType = "text" | "textarea" | "lines" | "image" | "link" | "handle";

export interface ModuleField {
  /** Pfad mit Punkten, zum Beispiel "cta.label" */
  path: string;
  label: string;
  type: ModuleFieldType;
  hint?: string;
  max?: number;
}

export interface ModuleRepeat {
  /** Listenschlüssel in der Konfiguration, zum Beispiel "items" */
  path: string;
  label: string;
  itemLabel: string;
  fields: ModuleField[];
  max: number;
}

export interface ModuleFieldSpec {
  description: string;
  fields: ModuleField[];
  repeat?: ModuleRepeat;
}

const cta: ModuleField[] = [
  { path: "cta.label", label: "Button-Text", type: "text", max: 60 },
  {
    path: "cta.url",
    label: "Button-Link",
    type: "link",
    hint: "Interner Pfad wie /collections/all",
  },
];

export const MODULE_FIELDS: Record<string, ModuleFieldSpec> = {
  hero: {
    description: "Erster Bildschirm mit Dose, Überschrift und Button",
    fields: [
      { path: "eyebrow", label: "Dachzeile", type: "text", max: 80 },
      { path: "headline", label: "Überschrift", type: "text", max: 160 },
      { path: "text", label: "Text", type: "textarea", max: 600 },
      { path: "badges", label: "Badges", type: "lines", hint: "Ein Badge je Zeile, höchstens 6" },
      ...cta,
      { path: "image", label: "Bild", type: "image" },
    ],
  },
  bestseller: {
    description: "Hervorgehobenes Produkt mit Packgrößen",
    fields: [
      { path: "eyebrow", label: "Dachzeile", type: "text", max: 80 },
      {
        path: "product_handle",
        label: "Produkt (Handle)",
        type: "handle",
        hint: "z.B. provibe-eistee-mixed",
      },
      { path: "details_label", label: "Link-Text zu den Details", type: "text", max: 60 },
    ],
  },
  flavors: {
    description: "Sortenkarten",
    fields: [
      { path: "eyebrow", label: "Dachzeile", type: "text", max: 80 },
      { path: "headline", label: "Überschrift", type: "text", max: 160 },
      ...cta,
    ],
    repeat: {
      path: "items",
      label: "Sorten",
      itemLabel: "Sorte",
      max: 12,
      fields: [
        { path: "product_handle", label: "Produkt (Handle)", type: "handle" },
        { path: "notes", label: "Geschmacksnoten", type: "text", max: 120 },
        { path: "image", label: "Bild", type: "image" },
      ],
    },
  },
  story: {
    description: "Banner mit Markenbotschaft",
    fields: [
      { path: "eyebrow", label: "Dachzeile", type: "text", max: 80 },
      { path: "headline", label: "Überschrift", type: "text", max: 160 },
      { path: "text", label: "Text", type: "textarea", max: 600 },
      ...cta,
      { path: "image", label: "Bild", type: "image" },
    ],
  },
  bundles: {
    description: "Founder Bundles aus einer Kollektion",
    fields: [
      { path: "eyebrow", label: "Dachzeile", type: "text", max: 80 },
      { path: "headline", label: "Überschrift", type: "text", max: 160 },
      { path: "badge", label: "Badge", type: "text", max: 40 },
      {
        path: "collection_handle",
        label: "Kollektion (Handle)",
        type: "handle",
        hint: "z.B. aktion",
      },
      ...cta,
    ],
  },
  faq: {
    description: "Fragen und Antworten (FAQPage im JSON-LD)",
    fields: [{ path: "headline", label: "Überschrift", type: "text", max: 160 }],
    repeat: {
      path: "items",
      label: "Fragen",
      itemLabel: "Frage",
      max: 30,
      fields: [
        { path: "question", label: "Frage", type: "text", max: 300 },
        { path: "answer", label: "Antwort", type: "textarea", max: 3000 },
      ],
    },
  },
  custom: {
    description: "Eigener Textblock",
    fields: [
      { path: "eyebrow", label: "Dachzeile", type: "text", max: 80 },
      { path: "headline", label: "Überschrift", type: "text", max: 160 },
      { path: "text", label: "Text", type: "textarea", max: 600 },
      ...cta,
      { path: "image", label: "Bild", type: "image" },
    ],
  },
};

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** Wert an einem Pfad lesen ("cta.label"). */
export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (isRec(acc) ? acc[key] : undefined), obj);
}

function setPath(obj: Rec, path: string, value: unknown): void {
  const keys = path.split(".");
  let cur: Rec = obj;
  for (const key of keys.slice(0, -1)) {
    if (!isRec(cur[key])) cur[key] = {};
    cur = cur[key] as Rec;
  }
  const last = keys[keys.length - 1];
  if (value === undefined) delete cur[last];
  else cur[last] = value;
}

function prune(obj: Rec): Rec {
  for (const [k, v] of Object.entries(obj)) {
    if (isRec(v)) {
      prune(v);
      if (Object.keys(v).length === 0) delete obj[k];
    }
  }
  return obj;
}

/** Feldwert für das Formular (Listen zeilenweise). */
export function fieldValue(config: unknown, field: ModuleField): string {
  const v = getPath(config, field.path);
  if (field.type === "lines")
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").join("\n") : "";
  return typeof v === "string" ? v : "";
}

function readField(field: ModuleField, raw: string | undefined): unknown {
  const value = (raw ?? "").trim();
  if (field.type === "lines") {
    const items = value
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return items.length ? items : undefined;
  }
  return value || undefined;
}

/**
 * Formularwerte (Name → Wert, Namen mit "cfg.") auf die bestehende Konfiguration anwenden.
 * Leere Felder entfernen den Schlüssel, leere Listeneinträge fallen weg.
 */
export function formToConfig(
  kind: string,
  values: Record<string, string>,
  base: Record<string, unknown> = {},
): Record<string, unknown> {
  const spec = MODULE_FIELDS[kind];
  const out: Rec = structuredClone(base);
  if (!spec) return out;
  for (const field of spec.fields) {
    setPath(out, field.path, readField(field, values[`cfg.${field.path}`]));
  }
  if (spec.repeat) {
    const r = spec.repeat;
    const previous = Array.isArray(out[r.path]) ? (out[r.path] as unknown[]) : [];
    const items: Rec[] = [];
    for (let i = 0; i < r.max; i++) {
      const prefix = `cfg.${r.path}.${i}.`;
      if (!Object.keys(values).some((k) => k.startsWith(prefix))) continue;
      if (values[`${prefix}_remove`]) continue;
      const item: Rec = isRec(previous[i]) ? structuredClone(previous[i] as Rec) : {};
      for (const field of r.fields)
        setPath(item, field.path, readField(field, values[`${prefix}${field.path}`]));
      const filled = r.fields.some((f) => getPath(item, f.path) !== undefined);
      if (filled) items.push(prune(item));
    }
    if (items.length) out[r.path] = items;
    else delete out[r.path];
  }
  return prune(out);
}

/** Kurzbeschreibung eines Moduls für die Liste (Überschrift oder Dachzeile). */
export function moduleSummary(kind: string, config: Record<string, unknown>): string {
  const pick = (p: string) => {
    const v = getPath(config, p);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const items = Array.isArray(config.items) ? config.items.length : 0;
  const parts = [pick("headline") ?? pick("eyebrow") ?? pick("product_handle")];
  if (kind === "flavors" && items) parts.push(`${items} Sorten`);
  if (kind === "faq" && items) parts.push(`${items} Fragen`);
  return parts.filter(Boolean).join(" · ") || (MODULE_FIELDS[kind]?.description ?? "");
}
