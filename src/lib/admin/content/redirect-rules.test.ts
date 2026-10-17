import { describe, expect, it } from "vitest";
import { checkRedirect, normalizeRedirectPath, normalizeRedirectTarget } from "./redirect-rules";

const existing = [
  { id: "1", fromPath: "/pages/a", toPath: "/pages/b", isEnabled: true },
  { id: "2", fromPath: "/pages/b", toPath: "/pages/c", isEnabled: true },
  { id: "3", fromPath: "/pages/alt", toPath: "/pages/x", isEnabled: false },
];

describe("Normalisierung", () => {
  it("wie die Storefront", () => {
    expect(normalizeRedirectPath("Pages//Alt/?x=1")).toBe("/pages/alt");
    expect(normalizeRedirectPath("/produkte/%C3%BCber")).toBe("/produkte/über");
  });
  it("lässt nur interne Pfade und http(s) als Ziel zu", () => {
    expect(normalizeRedirectTarget("collections/all")).toBe("/collections/all");
    expect(normalizeRedirectTarget("https://example.com/x")).toBe("https://example.com/x");
    expect(normalizeRedirectTarget("//evil.example")).toBeNull();
    expect(normalizeRedirectTarget("javascript:alert(1)")).toBeNull();
  });
});

describe("checkRedirect", () => {
  it("akzeptiert eine neue Weiterleitung", () => {
    const r = checkRedirect(
      { fromPath: "/Pages/Neu/", toPath: "/pages/kontakt", isEnabled: true },
      existing,
    );
    expect(r).toEqual({ ok: true, fromPath: "/pages/neu", toPath: "/pages/kontakt", warnings: [] });
  });
  it("erkennt doppelte Quellen, auch inaktive und anders geschrieben", () => {
    const r = checkRedirect({ fromPath: "/PAGES/ALT", toPath: "/", isEnabled: true }, existing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("fromPath");
  });
  it("erkennt direkte und mehrstufige Schleifen", () => {
    expect(checkRedirect({ fromPath: "/x", toPath: "/X/", isEnabled: true }, existing).ok).toBe(
      false,
    );
    const loop = checkRedirect(
      { fromPath: "/pages/c", toPath: "/pages/a", isEnabled: true },
      existing,
    );
    expect(loop.ok).toBe(false);
    if (!loop.ok) expect(loop.message).toContain("Schleife");
  });
  it("prüft inaktive Kandidaten nicht auf Schleifen", () => {
    expect(
      checkRedirect({ fromPath: "/pages/c", toPath: "/pages/a", isEnabled: false }, existing).ok,
    ).toBe(true);
  });
  it("meldet Ketten als Hinweis", () => {
    const r = checkRedirect(
      { fromPath: "/pages/z", toPath: "/pages/a", isEnabled: true },
      existing,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings[0]).toContain("/pages/c");
  });
  it("erlaubt beim Bearbeiten die eigene Quelle", () => {
    const r = checkRedirect(
      { id: "2", fromPath: "/pages/b", toPath: "/pages/d", isEnabled: true },
      existing,
    );
    expect(r.ok).toBe(true);
  });
  it("sperrt Startseite, Admin und Parameter", () => {
    for (const fromPath of ["/", "/admin/x", "/pages/a?x=1", "https://x.de/a"]) {
      expect(checkRedirect({ fromPath, toPath: "/pages/b", isEnabled: true }, []).ok).toBe(false);
    }
  });
});
