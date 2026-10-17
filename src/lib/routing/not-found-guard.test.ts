import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createHandleIndex,
  guardTarget,
  notFoundRewrite,
  NOT_FOUND_REWRITE_PATH,
  type HandleIndex,
  type HandleSets,
} from "./not-found-guard";

const sets = (product: string[] = ["peach"]): HandleSets => ({
  product: new Set(product),
  collection: new Set(["eistee"]),
  blog: new Set(["hallo-welt"]),
});

describe("guardTarget", () => {
  it("erkennt die dynamischen Storefront-Segmente", () => {
    expect(guardTarget("GET", "/products/peach")).toEqual({ kind: "product", handle: "peach" });
    expect(guardTarget("HEAD", "/collections/eistee")).toEqual({
      kind: "collection",
      handle: "eistee",
    });
    expect(guardTarget("GET", "/blogs/news/hallo-welt")).toEqual({
      kind: "blog",
      handle: "hallo-welt",
    });
  });

  it("lässt andere Pfade, Methoden und tiefere Pfade in Ruhe", () => {
    expect(guardTarget("POST", "/products/peach")).toBeNull();
    expect(guardTarget("GET", "/products")).toBeNull();
    expect(guardTarget("GET", "/collections")).toBeNull();
    expect(guardTarget("GET", "/blogs/news")).toBeNull();
    expect(guardTarget("GET", "/products/peach/extra")).toBeNull();
    expect(guardTarget("GET", "/pages/impressum")).toBeNull();
    expect(guardTarget("GET", "/admin/produkte/peach")).toBeNull();
  });

  it("Checkout-Token: nur offensichtlich ungültige Tokens werden zur 404", () => {
    expect(guardTarget("GET", "/checkout/danke/0b9c1f0e-3a5d-4c1e-9f7a-2d6b8e4c1a00")).toBeNull();
    expect(guardTarget("GET", "/checkout/danke/gibt-es-nicht")).toEqual({ kind: "invalid" });
  });

  it("kaputte Prozentkodierung ist ungültig", () => {
    expect(guardTarget("GET", "/products/%E0%A4%A")).toEqual({ kind: "invalid" });
  });
});

describe("createHandleIndex", () => {
  it("lädt einmal je TTL und entdoppelt parallele Aufrufe", async () => {
    let t = 0;
    const load = vi.fn(async () => sets());
    const index = createHandleIndex(load, { ttlMs: 1000, minReloadMs: 100, now: () => t });
    const [a, b] = await Promise.all([
      index.isMissing("product", "peach"),
      index.isMissing("collection", "eistee"),
    ]);
    expect([a, b]).toEqual([false, false]);
    expect(load).toHaveBeenCalledTimes(1);
    t = 999;
    expect(await index.isMissing("blog", "hallo-welt")).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
    t = 1000;
    await index.isMissing("product", "peach");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("lädt bei Fehltreffer nach, höchstens einmal je minReload, damit neue Produkte sofort gehen", async () => {
    let t = 0;
    const load = vi
      .fn<() => Promise<HandleSets | null>>()
      .mockResolvedValueOnce(sets())
      .mockResolvedValueOnce(sets(["peach", "neu"]))
      .mockResolvedValue(sets(["peach", "neu"]));
    const index = createHandleIndex(load, { ttlMs: 60_000, minReloadMs: 10_000, now: () => t });
    expect(await index.isMissing("product", "gibt-es-nicht")).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    t = 5_000;
    expect(await index.isMissing("product", "neu")).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    t = 10_000;
    expect(await index.isMissing("product", "neu")).toBe(false);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("fail open: ohne geladene Handles gilt nichts als unbekannt", async () => {
    const onError = vi.fn();
    const index = createHandleIndex(async () => Promise.reject(new Error("weg")), {
      now: () => 0,
      onError,
    });
    expect(await index.isMissing("product", "gibt-es-nicht")).toBe(false);
    expect(onError).toHaveBeenCalled();
    const unconfigured = createHandleIndex(async () => null, { now: () => 0 });
    expect(await unconfigured.isMissing("product", "gibt-es-nicht")).toBe(false);
  });

  it("behält nach einem Ladefehler die letzte gute Liste", async () => {
    let t = 0;
    const load = vi
      .fn<() => Promise<HandleSets | null>>()
      .mockResolvedValueOnce(sets())
      .mockRejectedValue(new Error("weg"));
    const index = createHandleIndex(load, {
      ttlMs: 1000,
      minReloadMs: 100,
      now: () => t,
      onError: () => {},
    });
    expect(await index.isMissing("product", "peach")).toBe(false);
    t = 2000;
    expect(await index.isMissing("product", "peach")).toBe(false);
    expect(await index.isMissing("product", "gibt-es-nicht")).toBe(true);
  });
});

describe("notFoundRewrite", () => {
  const index = (missing: boolean): HandleIndex => ({ isMissing: vi.fn(async () => missing) });
  const req = (path: string, method = "GET") =>
    new NextRequest(new URL(path, "https://shop.example"), { method });
  const rewriteTarget = (res: Response | null) => res?.headers.get("x-middleware-rewrite");

  it("schreibt unbekannte Handles auf die statische 404 um", async () => {
    const res = await notFoundRewrite(req("/products/gibt-es-nicht"), index(true));
    expect(rewriteTarget(res)).toBe(`https://shop.example${NOT_FOUND_REWRITE_PATH}`);
  });

  it("lässt bekannte Handles und fremde Pfade durch", async () => {
    expect(await notFoundRewrite(req("/products/peach"), index(false))).toBeNull();
    const idx = index(true);
    expect(await notFoundRewrite(req("/pages/impressum"), idx)).toBeNull();
    expect(idx.isMissing).not.toHaveBeenCalled();
  });

  it("ungültige Checkout-Tokens ohne Datenbankabfrage", async () => {
    const idx = index(false);
    const res = await notFoundRewrite(req("/checkout/danke/gibt-es-nicht"), idx);
    expect(rewriteTarget(res)).toBe(`https://shop.example${NOT_FOUND_REWRITE_PATH}`);
    expect(idx.isMissing).not.toHaveBeenCalled();
  });
});
