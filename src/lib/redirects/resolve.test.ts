import { describe, expect, it } from "vitest";
import {
  buildRedirectMap,
  normalizePath,
  notFoundLogLine,
  pathFromSegments,
  queryFromSearchParams,
  resolveRedirect,
  type RedirectRow,
} from "./resolve";

const row = (from: string, to: string, status = 301, enabled = true): RedirectRow => ({
  from_path: from,
  to_path: to,
  status_code: status,
  is_enabled: enabled,
});

describe("normalizePath", () => {
  it("führender Slash, ohne Trailing Slash, ohne Query", () => {
    expect(normalizePath("pages/alt")).toBe("/pages/alt");
    expect(normalizePath("/pages/alt/")).toBe("/pages/alt");
    expect(normalizePath("/pages/alt///")).toBe("/pages/alt");
    expect(normalizePath("//pages//alt")).toBe("/pages/alt");
    expect(normalizePath("/pages/alt?x=1#oben")).toBe("/pages/alt");
    expect(normalizePath(" /Pages/ALT ")).toBe("/pages/alt");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("")).toBe("/");
  });

  it("löst Prozent-Kodierung auf, kaputte Kodierung bleibt stehen", () => {
    expect(normalizePath("/pages/%C3%BCber-uns")).toBe("/pages/über-uns");
    expect(normalizePath("/pages/%E0%A4%A")).toBe("/pages/%e0%a4%a");
  });
});

describe("pathFromSegments und queryFromSearchParams", () => {
  it("setzt Segmente zusammen", () => {
    expect(pathFromSegments(["pages", "Alt"])).toBe("/pages/alt");
    expect(pathFromSegments(["pages", "%C3%BCber"])).toBe("/pages/über");
    expect(pathFromSegments(undefined)).toBe("/");
  });

  it("erhält die Query inklusive Mehrfachwerten", () => {
    expect(queryFromSearchParams({})).toBe("");
    expect(queryFromSearchParams({ utm_source: "qr", a: ["1", "2"], leer: undefined })).toBe(
      "?utm_source=qr&a=1&a=2",
    );
    expect(queryFromSearchParams({ q: "a b&c" })).toBe("?q=a+b%26c");
  });
});

describe("buildRedirectMap und resolveRedirect", () => {
  const map = buildRedirectMap([
    row("/pages/alte-seite/", "/pages/neue-seite"),
    row("Products/Alt", "/products/neu", 308),
    row("/aktion-sommer", "/collections/aktion?filter=bundles", 302),
    row("/messe-2026", "/pages/messe#programm", 307),
    row("/extern", "https://www.example.org/ziel"),
    row("/aus", "/pages/shop", 301, false),
    row("/schleife", "/schleife/"),
    row("/offen", "//evil.example"),
    row("/", "/pages/shop"),
    row("/ohne-ziel", "  "),
    row("/relativ", "pages/shop"),
  ]);

  it("normalisiert from_path, verwirft inaktive und ungültige Zeilen", () => {
    expect([...map.keys()].sort()).toEqual([
      "/aktion-sommer",
      "/extern",
      "/messe-2026",
      "/pages/alte-seite",
      "/products/alt",
      "/relativ",
    ]);
  });

  it("findet Pfade unabhängig von Slash und Schreibweise", () => {
    expect(resolveRedirect(map, "/pages/alte-seite")).toEqual({
      location: "/pages/neue-seite",
      status: 301,
      permanent: true,
    });
    expect(resolveRedirect(map, "/PAGES/alte-seite/")?.location).toBe("/pages/neue-seite");
    expect(resolveRedirect(map, "/products/alt")?.permanent).toBe(true);
    expect(resolveRedirect(map, "/relativ")?.location).toBe("/pages/shop");
    expect(resolveRedirect(map, "/gibt-es-nicht")).toBeNull();
    expect(resolveRedirect(map, "/aus")).toBeNull();
  });

  it("302 und 307 sind vorübergehend, der Status bleibt wie in der Tabelle", () => {
    expect(resolveRedirect(map, "/products/alt")?.status).toBe(308);
    expect(resolveRedirect(map, "/aktion-sommer")?.status).toBe(302);
    expect(resolveRedirect(map, "/aktion-sommer")?.permanent).toBe(false);
    expect(resolveRedirect(map, "/messe-2026")?.permanent).toBe(false);
  });

  it("hängt die Query an, auch an ein Ziel mit Query oder Fragment", () => {
    expect(resolveRedirect(map, "/pages/alte-seite", "?utm_source=qr")?.location).toBe(
      "/pages/neue-seite?utm_source=qr",
    );
    expect(resolveRedirect(map, "/aktion-sommer", "?sort=preis-auf")?.location).toBe(
      "/collections/aktion?filter=bundles&sort=preis-auf",
    );
    expect(resolveRedirect(map, "/messe-2026", "a=1")?.location).toBe("/pages/messe?a=1#programm");
    expect(resolveRedirect(map, "/extern", "?x=1")?.location).toBe(
      "https://www.example.org/ziel?x=1",
    );
  });
});

describe("notFoundLogLine", () => {
  it("ohne Query und Steuerzeichen, gekürzt", () => {
    expect(notFoundLogLine("/gibt-es-nicht?email=a@b.de")).toBe("404 /gibt-es-nicht");
    expect(notFoundLogLine("/a\nb\u0007c")).toBe("404 /abc");
    expect(notFoundLogLine("")).toBe("404 /");
    expect(notFoundLogLine(`/${"x".repeat(500)}`)).toHaveLength(304);
  });
});
