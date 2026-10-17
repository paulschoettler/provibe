import { stripTags } from "@/lib/content/html";

/**
 * Vergleich zweier Rechtstext-Fassungen auf Absatzebene (Backoffice "Vergleich alt gegen neu",
 * Figma 42:2737). Absätze werden über ihren Text (ohne Markup) verglichen; geänderte Absätze
 * bekommen zusätzlich einen Wortvergleich. Rein, getestet in diff.test.ts.
 */

export interface Paragraph {
  /** Block-Tag (p, h2, li, ...) oder "text" */
  tag: string;
  html: string;
  text: string;
}

export type WordSegment = { type: "equal" | "added" | "removed"; text: string };

export type DiffOp =
  | { type: "equal"; old: Paragraph; new: Paragraph }
  | { type: "added"; new: Paragraph }
  | { type: "removed"; old: Paragraph }
  | { type: "changed"; old: Paragraph; new: Paragraph; words: WordSegment[] };

export interface DiffResult {
  ops: DiffOp[];
  summary: { equal: number; added: number; removed: number; changed: number };
}

const BLOCK_RE = /<(p|h[1-6]|li|blockquote|pre|td|th|dt|dd)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;

export function splitParagraphs(html: string): Paragraph[] {
  const out: Paragraph[] = [];
  let m: RegExpExecArray | null;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(html))) {
    const text = stripTags(m[3]);
    if (text) out.push({ tag: m[1].toLowerCase(), html: m[0], text });
  }
  if (out.length > 0) return out;
  // Ohne Block-Tags: Leerzeilen bzw. doppelte <br> trennen Absätze
  return html
    .split(/(?:<br\s*\/?>\s*){2,}|\n\s*\n/i)
    .map((part) => ({ tag: "text", html: part.trim(), text: stripTags(part) }))
    .filter((p) => p.text);
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Längste gemeinsame Teilfolge als Paare von Indizes. */
function lcsPairs<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): [number, number][] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

export function diffWords(oldText: string, newText: string): WordSegment[] {
  const a = normalize(oldText).split(" ").filter(Boolean);
  const b = normalize(newText).split(" ").filter(Boolean);
  const pairs = lcsPairs(a, b, (x, y) => x === y);
  const out: WordSegment[] = [];
  const push = (type: WordSegment["type"], text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += ` ${text}`;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [a.length, b.length] as [number, number]]) {
    while (i < pi) push("removed", a[i++]);
    while (j < pj) push("added", b[j++]);
    if (pi < a.length && pj < b.length) {
      push("equal", a[pi]);
      i = pi + 1;
      j = pj + 1;
    }
  }
  return out;
}

/** Wortähnlichkeit (Jaccard) zweier Absätze, 0 bis 1. */
export function similarity(a: string, b: string): number {
  const wa = new Set(normalize(a).toLowerCase().split(" ").filter(Boolean));
  const wb = new Set(normalize(b).toLowerCase().split(" ").filter(Boolean));
  if (wa.size === 0 && wb.size === 0) return 1;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}

export function diffParagraphs(oldHtml: string, newHtml: string, threshold = 0.4): DiffResult {
  const a = splitParagraphs(oldHtml);
  const b = splitParagraphs(newHtml);
  const pairs = lcsPairs(a, b, (x, y) => normalize(x.text) === normalize(y.text));
  const ops: DiffOp[] = [];

  const flushGap = (removed: Paragraph[], added: Paragraph[]) => {
    // Entfernte und hinzugefügte Absätze an derselben Stelle paarweise als "geändert" zeigen,
    // wenn sie sich ähnlich genug sind
    let r = 0;
    let s = 0;
    while (r < removed.length || s < added.length) {
      const ro = removed[r];
      const ad = added[s];
      if (ro && ad && similarity(ro.text, ad.text) >= threshold) {
        ops.push({ type: "changed", old: ro, new: ad, words: diffWords(ro.text, ad.text) });
        r++;
        s++;
      } else if (ro && (!ad || removed.length - r >= added.length - s)) {
        ops.push({ type: "removed", old: ro });
        r++;
      } else if (ad) {
        ops.push({ type: "added", new: ad });
        s++;
      }
    }
  };

  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [a.length, b.length] as [number, number]]) {
    flushGap(a.slice(i, pi), b.slice(j, pj));
    if (pi < a.length && pj < b.length) ops.push({ type: "equal", old: a[pi], new: b[pj] });
    i = pi + 1;
    j = pj + 1;
  }

  const summary = { equal: 0, added: 0, removed: 0, changed: 0 };
  for (const op of ops) summary[op.type]++;
  return { ops, summary };
}
