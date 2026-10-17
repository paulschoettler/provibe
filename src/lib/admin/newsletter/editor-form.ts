import type { CampaignBlock } from "@/emails/campaign";

/**
 * Block-Editor der Kampagnen: Formularfelder lesen, Blöcke hinzufügen, verschieben und entfernen.
 * Dieselben Funktionen laufen im Browser (sofort, mit JavaScript) und in der Server Action
 * (ohne JavaScript über die Buttons name="intent"). Rein, getestet in editor-form.test.ts.
 *
 * Feldnamen: blocks.<i>.<feld>, zum Beispiel blocks.0.type, blocks.0.heading. So passen die
 * Zod-Pfade der Validierung (blocks.0.heading) direkt zu den Eingabefeldern.
 */

export const BLOCK_TYPES = ["text", "image", "product", "button", "divider"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_LABELS: Record<BlockType, string> = {
  text: "Text",
  image: "Bild",
  product: "Produkt",
  button: "Button",
  divider: "Trenner",
};

/** Entwurf eines Blocks: wie CampaignBlock, aber Felder dürfen noch leer sein. */
export type DraftBlock =
  | { id: string; type: "text"; heading: string; body: string }
  | { id: string; type: "image"; src: string; alt: string; href: string }
  | { id: string; type: "product"; productHandle: string; variantId: string }
  | { id: string; type: "button"; label: string; href: string }
  | { id: string; type: "divider" };

export type EditorIntent =
  | { kind: "save" }
  | { kind: "add"; type: BlockType }
  | { kind: "up" | "down" | "remove"; index: number };

export const MAX_BLOCKS = 60;

export function newBlockId(existing: { id: string }[], seed = Date.now()): string {
  const ids = new Set(existing.map((b) => b.id));
  let n = seed % 1_000_000;
  let id = `b${n.toString(36)}`;
  while (ids.has(id)) {
    n += 1;
    id = `b${n.toString(36)}`;
  }
  return id;
}

export function newBlock(type: BlockType, id: string): DraftBlock {
  switch (type) {
    case "text":
      return { id, type, heading: "", body: "" };
    case "image":
      return { id, type, src: "", alt: "", href: "" };
    case "product":
      return { id, type, productHandle: "", variantId: "" };
    case "button":
      return { id, type, label: "Jetzt entdecken", href: "/collections/all" };
    case "divider":
      return { id, type };
  }
}

export function toDraft(block: CampaignBlock): DraftBlock {
  switch (block.type) {
    case "text":
      return { id: block.id, type: "text", heading: block.heading ?? "", body: block.body ?? "" };
    case "image":
      return {
        id: block.id,
        type: "image",
        src: block.src,
        alt: block.alt,
        href: block.href ?? "",
      };
    case "product":
      return {
        id: block.id,
        type: "product",
        productHandle: block.productHandle,
        variantId: block.variantId ?? "",
      };
    case "button":
      return { id: block.id, type: "button", label: block.label, href: block.href };
    case "divider":
      return { id: block.id, type: "divider" };
  }
}

/** Entwurf in die Eingabe für Zod (leere optionale Felder entfallen). */
export function fromDraft(block: DraftBlock): Record<string, string> {
  switch (block.type) {
    case "text":
      return { id: block.id, type: block.type, heading: block.heading, body: block.body };
    case "image":
      return {
        id: block.id,
        type: block.type,
        src: block.src,
        alt: block.alt,
        ...(block.href.trim() ? { href: block.href } : {}),
      };
    case "product":
      return {
        id: block.id,
        type: block.type,
        productHandle: block.productHandle,
        ...(block.variantId.trim() ? { variantId: block.variantId } : {}),
      };
    case "button":
      return { id: block.id, type: block.type, label: block.label, href: block.href };
    case "divider":
      return { id: block.id, type: block.type };
  }
}

function text(entries: Map<string, string>, key: string): string {
  return entries.get(key) ?? "";
}

/** Blöcke aus den Formularfeldern blocks.<i>.<feld> lesen, sortiert nach i. */
export function parseBlocks(entries: Iterable<[string, string]>): DraftBlock[] {
  const map = new Map<string, string>();
  const indexes = new Set<number>();
  for (const [k, v] of entries) {
    const m = /^blocks\.(\d{1,3})\.([a-zA-Z]+)$/.exec(k);
    if (!m) continue;
    map.set(k, v);
    indexes.add(Number(m[1]));
  }
  const out: DraftBlock[] = [];
  for (const i of Array.from(indexes).sort((a, b) => a - b)) {
    const p = `blocks.${i}.`;
    const type = text(map, `${p}type`) as BlockType;
    const id = text(map, `${p}id`).trim().slice(0, 40) || `b${i}`;
    switch (type) {
      case "text":
        out.push({ id, type, heading: text(map, `${p}heading`), body: text(map, `${p}body`) });
        break;
      case "image":
        out.push({
          id,
          type,
          src: text(map, `${p}src`),
          alt: text(map, `${p}alt`),
          href: text(map, `${p}href`),
        });
        break;
      case "product": {
        const raw = text(map, `${p}productHandle`);
        const [handle, variant] = raw.includes(":") ? raw.split(":") : [raw, ""];
        out.push({
          id,
          type,
          productHandle: handle,
          variantId: variant || text(map, `${p}variantId`),
        });
        break;
      }
      case "button":
        out.push({ id, type, label: text(map, `${p}label`), href: text(map, `${p}href`) });
        break;
      case "divider":
        out.push({ id, type });
        break;
      default:
        break;
    }
    if (out.length >= MAX_BLOCKS) break;
  }
  return out;
}

export function parseIntent(raw: string | null | undefined): EditorIntent {
  const v = (raw ?? "").trim();
  const add = /^add:(text|image|product|button|divider)$/.exec(v);
  if (add) return { kind: "add", type: add[1] as BlockType };
  const move = /^(up|down|remove):(\d{1,3})$/.exec(v);
  if (move) return { kind: move[1] as "up" | "down" | "remove", index: Number(move[2]) };
  return { kind: "save" };
}

/** Intent anwenden. Liefert neue Liste und den Index des betroffenen Blocks (für den Fokus). */
export function applyIntent(
  blocks: DraftBlock[],
  intent: EditorIntent,
  seed?: number,
): { blocks: DraftBlock[]; focus: number | null } {
  const list = [...blocks];
  switch (intent.kind) {
    case "save":
      return { blocks: list, focus: null };
    case "add": {
      if (list.length >= MAX_BLOCKS) return { blocks: list, focus: null };
      list.push(newBlock(intent.type, newBlockId(list, seed)));
      return { blocks: list, focus: list.length - 1 };
    }
    case "remove": {
      if (intent.index < 0 || intent.index >= list.length) return { blocks: list, focus: null };
      list.splice(intent.index, 1);
      return { blocks: list, focus: list.length ? Math.min(intent.index, list.length - 1) : null };
    }
    case "up":
    case "down": {
      const to = intent.kind === "up" ? intent.index - 1 : intent.index + 1;
      if (intent.index < 0 || intent.index >= list.length || to < 0 || to >= list.length)
        return { blocks: list, focus: intent.index };
      const [b] = list.splice(intent.index, 1);
      list.splice(to, 0, b);
      return { blocks: list, focus: to };
    }
  }
}

/** Kurzbeschreibung eines Blocks für die Aufbau-Liste. */
export function blockSummary(block: DraftBlock, productNames: Record<string, string> = {}): string {
  switch (block.type) {
    case "text":
      return block.heading || block.body.slice(0, 60) || "leer";
    case "image":
      return block.alt || block.src || "kein Bild gewählt";
    case "product":
      return productNames[block.productHandle] ?? (block.productHandle || "kein Produkt gewählt");
    case "button":
      return block.label || "ohne Beschriftung";
    case "divider":
      return "Linie";
  }
}

/**
 * Datum und Uhrzeit in Europe/Berlin (aus input type=date und type=time) als UTC-ISO-String.
 * null bei ungültiger Eingabe. Sommer- und Winterzeit werden berücksichtigt.
 */
export function berlinLocalToIso(date: string, time: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const t = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const [y, mo, da, h, mi] = [+d[1], +d[2], +d[3], +t[1], +t[2]];
  if (mo < 1 || mo > 12 || da < 1 || da > 31 || h > 23 || mi > 59) return null;
  const guess = Date.UTC(y, mo - 1, da, h, mi);
  const offset = (ms: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Berlin",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(ms));
    const get = (k: string) => Number(parts.find((p) => p.type === k)?.value);
    return (
      (Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - ms) / 60000
    );
  };
  let ms = guess - offset(guess) * 60000;
  ms = guess - offset(ms) * 60000;
  const check = new Date(ms);
  if (Number.isNaN(check.getTime())) return null;
  return check.toISOString();
}
