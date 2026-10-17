import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createRedirectCache, isRedirectCandidate, redirectFromTable } from "./proxy";
import type { RedirectRow } from "./resolve";

const rows: RedirectRow[] = [
  { from_path: "/pages/alt", to_path: "/pages/neu", status_code: 301, is_enabled: true },
  { from_path: "/products/alt", to_path: "/products/neu", status_code: 308, is_enabled: true },
  { from_path: "/sommer", to_path: "/collections/aktion", status_code: 302, is_enabled: true },
  { from_path: "/api/alt", to_path: "/api/neu", status_code: 301, is_enabled: true },
];

describe("createRedirectCache", () => {
  it("lädt einmal je TTL und entdoppelt parallele Aufrufe", async () => {
    let t = 0;
    const load = vi.fn(async () => rows);
    const cache = createRedirectCache(load, { ttlMs: 1000, now: () => t });
    const [a, b] = await Promise.all([cache.get(), cache.get()]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(a.get("/pages/alt")?.to).toBe("/pages/neu");
    t = 999;
    await cache.get();
    expect(load).toHaveBeenCalledTimes(1);
    t = 1000;
    await cache.get();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("behält nach einem Fehler die letzte gute Map und versucht es nach 30 Sekunden erneut", async () => {
    let t = 0;
    const onError = vi.fn();
    const load = vi
      .fn<() => Promise<RedirectRow[]>>()
      .mockResolvedValueOnce(rows)
      .mockRejectedValueOnce(new Error("weg"))
      .mockResolvedValueOnce([]);
    const cache = createRedirectCache(load, { ttlMs: 300_000, now: () => t, onError });
    expect((await cache.get()).size).toBe(4);
    t = 300_000;
    expect((await cache.get()).size).toBe(4);
    expect(onError).toHaveBeenCalledTimes(1);
    t = 310_000;
    expect((await cache.get()).size).toBe(4);
    expect(load).toHaveBeenCalledTimes(2);
    t = 330_000;
    expect((await cache.get()).size).toBe(0);
  });
});

describe("isRedirectCandidate", () => {
  it("nur GET und HEAD, nicht für Startseite, _next, api, admin", () => {
    expect(isRedirectCandidate("GET", "/pages/alt")).toBe(true);
    expect(isRedirectCandidate("HEAD", "/products/alt")).toBe(true);
    expect(isRedirectCandidate("POST", "/pages/alt")).toBe(false);
    expect(isRedirectCandidate("GET", "/")).toBe(false);
    expect(isRedirectCandidate("GET", "/_next/static/x.js")).toBe(false);
    expect(isRedirectCandidate("GET", "/api/alt")).toBe(false);
    expect(isRedirectCandidate("GET", "/admin")).toBe(false);
    expect(isRedirectCandidate("GET", "/admin/kunden")).toBe(false);
    expect(isRedirectCandidate("GET", "/administration")).toBe(false);
  });
});

describe("redirectFromTable", () => {
  const cache = createRedirectCache(async () => rows);
  const req = (path: string, method = "GET") =>
    new NextRequest(new URL(path, "https://shop.example"), { method });

  it("leitet mit dem Status aus der Tabelle weiter und erhält die Query", async () => {
    const res = await redirectFromTable(req("/pages/alt/?utm_source=qr"), cache);
    expect(res?.status).toBe(301);
    expect(res?.headers.get("location")).toBe("https://shop.example/pages/neu?utm_source=qr");
    expect((await redirectFromTable(req("/Products/Alt"), cache))?.status).toBe(308);
    expect((await redirectFromTable(req("/sommer"), cache))?.status).toBe(302);
  });

  it("lässt unbekannte und ausgenommene Pfade durch", async () => {
    expect(await redirectFromTable(req("/gibt-es-nicht"), cache)).toBeNull();
    expect(await redirectFromTable(req("/api/alt"), cache)).toBeNull();
    expect(await redirectFromTable(req("/pages/alt", "POST"), cache)).toBeNull();
  });
});
