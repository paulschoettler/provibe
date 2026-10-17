import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { brandSvg, parseBrandSvg } = await import("./svg-source");

const NAMES = [
  ["erdbeere", "fruits"],
  ["himbeere", "fruits"],
  ["heidelbeere", "fruits"],
  ["limette-scheibe", "fruits"],
  ["pfirsich-blatt-gross", "fruits"],
  ["pfirsich-blatt-klein", "fruits"],
  ["pfirsich-rund", "fruits"],
  ["pfirsich-gruppe", "fruits"],
  ["check", "ui"],
  ["instagram", "ui"],
  ["tiktok", "ui"],
] as const;

describe("CI-SVGs inline", () => {
  it.each(NAMES)("%s: viewBox und Pfade unverändert, ohne Metadaten", (name, group) => {
    const source = readFileSync(
      path.join(process.cwd(), `brand/provibe-ci/icons/${group}/${name}.svg`),
      "utf8",
    );
    const svg = brandSvg(name);
    expect(source).toContain(`viewBox="${svg.viewBox}"`);
    expect(svg.inner).not.toContain("metadata");
    expect(svg.inner).not.toContain("<svg");
    const paths = (s: string) => s.match(/<path\b[^>]*>/g) ?? [];
    expect(paths(svg.inner)).toEqual(paths(source));
    expect(paths(svg.inner).length).toBeGreaterThan(0);
  });

  it("lehnt Dateien ohne viewBox ab", () => {
    expect(() => parseBrandSvg("<svg><path d='M0 0'/></svg>")).toThrow();
  });
});
