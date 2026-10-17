import { describe, expect, it } from "vitest";
import { currentVersionOf } from "./versions";

describe("currentVersionOf", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  it("nimmt die zuletzt gültig gewordene veröffentlichte Version", () => {
    const v = currentVersionOf(
      [
        { version: 1, status: "published" as const, effective_from: "2026-09-21T00:00:00Z" },
        { version: 2, status: "published" as const, effective_from: "2026-10-01T00:00:00Z" },
        { version: 3, status: "published" as const, effective_from: "2026-11-01T00:00:00Z" },
        { version: 4, status: "draft" as const, effective_from: null },
      ],
      now,
    );
    expect(v?.version).toBe(2);
  });
  it("liefert null ohne veröffentlichte Version", () => {
    expect(
      currentVersionOf([{ version: 1, status: "draft" as const, effective_from: null }], now),
    ).toBeNull();
  });
});
