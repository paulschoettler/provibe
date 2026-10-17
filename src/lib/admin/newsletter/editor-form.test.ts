import { describe, expect, it } from "vitest";
import { campaignBlocksSchema } from "@/emails/campaign";
import {
  applyIntent,
  berlinLocalToIso,
  fromDraft,
  newBlock,
  parseBlocks,
  parseIntent,
  toDraft,
  type DraftBlock,
} from "./editor-form";

const blocks: DraftBlock[] = [
  { id: "a", type: "text", heading: "Peach ist zurück.", body: "Wieder da." },
  { id: "b", type: "product", productHandle: "peach", variantId: "" },
  { id: "c", type: "divider" },
];

describe("parseBlocks", () => {
  it("liest Blöcke aus blocks.<i>.<feld> in Reihenfolge des Index", () => {
    const parsed = parseBlocks([
      ["name", "Kampagne"],
      ["blocks.1.id", "b"],
      ["blocks.1.type", "button"],
      ["blocks.1.label", "Los"],
      ["blocks.1.href", "/products/peach"],
      ["blocks.0.id", "a"],
      ["blocks.0.type", "text"],
      ["blocks.0.heading", "Hallo"],
      ["blocks.0.body", "Text"],
      ["blocks.2.id", "c"],
      ["blocks.2.type", "product"],
      ["blocks.2.productHandle", "peach:6a1f0c2e-1111-4222-8333-944445555666"],
      ["blocks.3.type", "unbekannt"],
    ]);
    expect(parsed).toEqual([
      { id: "a", type: "text", heading: "Hallo", body: "Text" },
      { id: "b", type: "button", label: "Los", href: "/products/peach" },
      {
        id: "c",
        type: "product",
        productHandle: "peach",
        variantId: "6a1f0c2e-1111-4222-8333-944445555666",
      },
    ]);
  });
});

describe("applyIntent", () => {
  it("verschiebt nach oben und unten, Ränder bleiben stehen", () => {
    expect(applyIntent(blocks, { kind: "up", index: 1 }).blocks.map((b) => b.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(applyIntent(blocks, { kind: "down", index: 1 }).blocks.map((b) => b.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(applyIntent(blocks, { kind: "up", index: 0 }).blocks).toEqual(blocks);
    expect(applyIntent(blocks, { kind: "down", index: 2 }).blocks).toEqual(blocks);
  });

  it("entfernt und fügt mit eindeutiger ID hinzu", () => {
    const removed = applyIntent(blocks, { kind: "remove", index: 0 });
    expect(removed.blocks.map((b) => b.id)).toEqual(["b", "c"]);
    expect(removed.focus).toBe(0);
    const added = applyIntent(blocks, { kind: "add", type: "button" }, 42);
    expect(added.blocks).toHaveLength(4);
    expect(added.focus).toBe(3);
    expect(added.blocks[3].type).toBe("button");
    expect(new Set(added.blocks.map((b) => b.id)).size).toBe(4);
  });

  it("liest Intents aus dem Button-Wert", () => {
    expect(parseIntent("add:image")).toEqual({ kind: "add", type: "image" });
    expect(parseIntent("down:3")).toEqual({ kind: "down", index: 3 });
    expect(parseIntent("remove:12")).toEqual({ kind: "remove", index: 12 });
    expect(parseIntent("drop:1")).toEqual({ kind: "save" });
    expect(parseIntent(null)).toEqual({ kind: "save" });
  });
});

describe("fromDraft und toDraft", () => {
  it("erzeugt gültige Blöcke für das Schema und lässt leere optionale Felder weg", () => {
    const input = [
      ...blocks,
      { id: "d", type: "image", src: "/bild.png", alt: "Dose", href: "" } as DraftBlock,
      newBlock("button", "e"),
    ].map(fromDraft);
    const parsed = campaignBlocksSchema.parse(input);
    expect(parsed[1]).toEqual({ id: "b", type: "product", productHandle: "peach" });
    expect(parsed[3]).toEqual({ id: "d", type: "image", src: "/bild.png", alt: "Dose" });
    expect(parsed.map(toDraft)[0]).toEqual(blocks[0]);
  });

  it("meldet leere Pflichtfelder mit Pfad blocks.<i>.<feld>", () => {
    const res = campaignBlocksSchema.safeParse([fromDraft(newBlock("image", "x"))]);
    expect(res.success).toBe(false);
    const paths = res.success ? [] : res.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("0.src");
    expect(paths).toContain("0.alt");
  });
});

describe("berlinLocalToIso", () => {
  it("rechnet Sommer- und Winterzeit korrekt in UTC um", () => {
    expect(berlinLocalToIso("2026-10-24", "10:00")).toBe("2026-10-24T08:00:00.000Z");
    expect(berlinLocalToIso("2026-12-01", "10:00")).toBe("2026-12-01T09:00:00.000Z");
  });

  it("lehnt ungültige Eingaben ab", () => {
    expect(berlinLocalToIso("24.10.2026", "10:00")).toBeNull();
    expect(berlinLocalToIso("2026-10-24", "25:00")).toBeNull();
  });
});
