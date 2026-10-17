import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { diffAudit, escapeLike } = await import("./audit-query");

describe("Protokoll: Vorher und Nachher", () => {
  it("vergleicht Felder der obersten Ebene", () => {
    expect(diffAudit({ role: "owner", x: 1 }, { role: "admin", x: 1 })).toEqual([
      { key: "role", before: "owner", after: "admin", changed: true },
      { key: "x", before: 1, after: 1, changed: false },
    ]);
  });
  it("nur Nachher (Anlegen) oder nur Vorher (Löschen)", () => {
    expect(diffAudit(null, { method: "password" })).toEqual([
      { key: "method", before: undefined, after: "password", changed: true },
    ]);
    expect(diffAudit({ a: [1] }, null)).toEqual([
      { key: "a", before: [1], after: undefined, changed: true },
    ]);
  });
  it("einfache Werte und leere Einträge", () => {
    expect(diffAudit(null, null)).toEqual([]);
    expect(diffAudit("alt", "neu")).toEqual([
      { key: "Wert", before: "alt", after: "neu", changed: true },
    ]);
  });
  it("entschärft ilike-Platzhalter", () => {
    expect(escapeLike("50%_rabatt\\")).toBe("50\\%\\_rabatt\\\\");
  });
});
