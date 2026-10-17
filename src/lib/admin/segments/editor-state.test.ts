import { describe, expect, it } from "vitest";
import {
  centsToEuro,
  euroToCents,
  parseEditorParams,
  rowsToRules,
  rulesToRows,
  stateToParams,
  valueKind,
} from "./editor-state";

describe("parseEditorParams", () => {
  it("liest Bedingungen aus der URL und korrigiert unpassende Operatoren", () => {
    const state = parseEditorParams({
      name: " Stammkunden ",
      match: "any",
      f0: "orders_count",
      o0: "gte",
      v0: "2",
      f1: "last_order",
      o1: "gte", // passt nicht zu last_order
      v1: "60",
      f2: "drop_table",
      f3: "newsletter_status",
      o3: "is",
      v3: "unbekannt",
    });
    expect(state.name).toBe("Stammkunden");
    expect(state.match).toBe("any");
    expect(state.rows).toEqual([
      { field: "orders_count", op: "gte", value: "2" },
      { field: "last_order", op: "older_than_days", value: "60" },
      { field: "newsletter_status", op: "is", value: "subscribed" },
    ]);
  });

  it("hängt mit add eine Zeile an und entfernt mit del", () => {
    const base = { f0: "tag", o0: "has", v0: "VIP", f1: "orders_count", o1: "gt", v1: "1" };
    expect(parseEditorParams({ ...base, add: "1" }).rows).toHaveLength(3);
    expect(parseEditorParams({ ...base, del: "0" }).rows).toEqual([
      { field: "orders_count", op: "gt", value: "1" },
    ]);
  });
});

describe("rowsToRules", () => {
  it("übersetzt Euro in Cent und Tage in Zahlen", () => {
    const { rules, errors } = rowsToRules({
      name: "x",
      description: "",
      match: "all",
      rows: [
        { field: "total_spent_cents", op: "gte", value: "49,90" },
        { field: "last_order", op: "older_than_days", value: "60" },
        { field: "first_order", op: "is_empty", value: "" },
        { field: "purchased_product", op: "is", value: "peach" },
      ],
    });
    expect(errors).toEqual({});
    expect(rules?.conditions).toEqual([
      { field: "total_spent_cents", op: "gte", value: 4990 },
      { field: "last_order", op: "older_than_days", value: 60 },
      { field: "first_order", op: "is_empty" },
      { field: "purchased_product", op: "is", value: "peach" },
    ]);
  });

  it("meldet ungültige Zeilen mit Index", () => {
    const { rules, errors } = rowsToRules({
      name: "x",
      description: "",
      match: "all",
      rows: [
        { field: "orders_count", op: "gte", value: "" },
        { field: "total_spent_cents", op: "gte", value: "viel" },
        { field: "last_order", op: "before", value: "2026-13-01" },
        { field: "tag", op: "has", value: "ok" },
      ],
    });
    expect(rules).toBeNull();
    expect(Object.keys(errors)).toEqual(["0", "1", "2"]);
  });
});

describe("Umrechnung und Rundweg", () => {
  it("rechnet Euro und Cent in beide Richtungen", () => {
    expect(euroToCents("50")).toBe(5000);
    expect(euroToCents("1.234,50")).toBe(123450);
    expect(euroToCents("12.5")).toBe(1250);
    expect(euroToCents("abc")).toBeNull();
    expect(centsToEuro(5000)).toBe("50");
    expect(centsToEuro(4990)).toBe("49,90");
  });

  it("überführt gespeicherte Regeln verlustfrei zurück in die URL", () => {
    const rows = rulesToRows({
      match: "all",
      conditions: [
        { field: "total_spent_cents", op: "gt", value: 10000 },
        { field: "tag", op: "has_not", value: "Test" },
      ],
    });
    const params = stateToParams({ name: "A", description: "", match: "all", rows });
    expect(parseEditorParams(params).rows).toEqual(rows);
    expect(rowsToRules(parseEditorParams(params)).rules?.conditions[0]).toEqual({
      field: "total_spent_cents",
      op: "gt",
      value: 10000,
    });
  });

  it("bestimmt die Eingabeart je Feld und Operator", () => {
    expect(valueKind("last_order", "within_days")).toBe("days");
    expect(valueKind("last_order", "after")).toBe("date");
    expect(valueKind("acquisition_source", "is_empty")).toBe("none");
    expect(valueKind("total_spent_cents", "gte")).toBe("euro");
  });
});
