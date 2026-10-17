import { describe, expect, it } from "vitest";
import {
  altTextFor,
  buildPublicImageUrl,
  checkImage,
  fileStem,
  imageStoragePath,
  isRemovableUploadPath,
  MAX_IMAGE_BYTES,
  orderError,
  pendingUploadPath,
  readImageSize,
  sniffImageType,
} from "./rules";

const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function png(w: number, h: number): Uint8Array {
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...u32(13),
    ...ascii("IHDR"),
    ...u32(w),
    ...u32(h),
    8,
    6,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);
}

function jpeg(w: number, h: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    // APP0 (JFIF), Länge 16
    0xff,
    0xe0,
    0x00,
    0x10,
    ...ascii("JFIF"),
    0,
    1,
    1,
    0,
    0,
    1,
    0,
    1,
    0,
    0,
    // DHT (wird übersprungen, kein SOF), Länge 4
    0xff,
    0xc4,
    0x00,
    0x04,
    0,
    0,
    // SOF0: Länge 17, Präzision 8, Höhe, Breite
    0xff,
    0xc0,
    0x00,
    0x11,
    8,
    (h >> 8) & 255,
    h & 255,
    (w >> 8) & 255,
    w & 255,
    3,
    1,
    0x22,
    0,
    2,
    0x11,
    1,
    3,
    0x11,
    1,
  ]);
}

function webpVp8x(w: number, h: number): Uint8Array {
  const w1 = w - 1;
  const h1 = h - 1;
  return new Uint8Array([
    ...ascii("RIFF"),
    0,
    0,
    0,
    0,
    ...ascii("WEBP"),
    ...ascii("VP8X"),
    10,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    w1 & 255,
    (w1 >> 8) & 255,
    (w1 >> 16) & 255,
    h1 & 255,
    (h1 >> 8) & 255,
    (h1 >> 16) & 255,
  ]);
}

function avif(w: number, h: number): Uint8Array {
  return new Uint8Array([
    ...u32(24),
    ...ascii("ftyp"),
    ...ascii("avif"),
    0,
    0,
    0,
    0,
    ...ascii("mif1"),
    ...ascii("miaf"),
    ...u32(20),
    ...ascii("ispe"),
    0,
    0,
    0,
    0,
    ...u32(w),
    ...u32(h),
  ]);
}

describe("Dateityp aus den ersten Bytes", () => {
  it("erkennt PNG, JPEG, WebP und AVIF", () => {
    expect(sniffImageType(png(800, 600))).toBe("image/png");
    expect(sniffImageType(jpeg(800, 600))).toBe("image/jpeg");
    expect(sniffImageType(webpVp8x(800, 600))).toBe("image/webp");
    expect(sniffImageType(avif(800, 600))).toBe("image/avif");
  });
  it("lehnt GIF, SVG und Text ab", () => {
    expect(sniffImageType(new Uint8Array(ascii("GIF89a......")))).toBeNull();
    expect(sniffImageType(new Uint8Array(ascii("<svg xmlns=")))).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
  });
});

describe("Abmessungen", () => {
  it("liest Breite und Höhe", () => {
    expect(readImageSize(png(1517, 1200), "image/png")).toEqual({ width: 1517, height: 1200 });
    expect(readImageSize(jpeg(2655, 3386), "image/jpeg")).toEqual({ width: 2655, height: 3386 });
    expect(readImageSize(webpVp8x(2048, 2048), "image/webp")).toEqual({
      width: 2048,
      height: 2048,
    });
    expect(readImageSize(avif(1200, 900), "image/avif")).toEqual({ width: 1200, height: 900 });
  });
});

describe("checkImage", () => {
  it("akzeptiert ein passendes Bild", () => {
    const r = checkImage(png(800, 600), "image/png");
    expect(r).toEqual({
      ok: true,
      image: { type: "image/png", extension: "png", width: 800, height: 600 },
    });
  });
  it("lehnt falschen Typ, zu kleine und zu große Dateien ab", () => {
    expect(checkImage(png(800, 600), "image/jpeg").ok).toBe(false);
    expect(checkImage(png(100, 600)).ok).toBe(false);
    expect(checkImage(new Uint8Array(0)).ok).toBe(false);
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(png(800, 600));
    expect(checkImage(big).ok).toBe(false);
    expect(checkImage(new Uint8Array(ascii("<script>alert(1)</script>")), "image/png").ok).toBe(
      false,
    );
  });
  it("image/jpg und octet-stream gelten als unbestimmt bzw. JPEG", () => {
    expect(checkImage(jpeg(800, 600), "image/jpg").ok).toBe(true);
    expect(checkImage(jpeg(800, 600), "application/octet-stream").ok).toBe(true);
  });
});

describe("Pfade und URLs", () => {
  it("bildet Pfade aus Handle und Hash", () => {
    expect(imageStoragePath("peach", "a1b2c3d4e5f6a7b8c9", "webp")).toBe(
      "products/peach/peach-a1b2c3d4e5f6.webp",
    );
    expect(pendingUploadPath("peach", "tok", "Peach Dose (2).PNG")).toBe(
      "uploads/peach/tok-peach-dose-2",
    );
    expect(fileStem("Über uns.jpg")).toBe("ueber-uns");
  });
  it("seed/ wird nie gelöscht", () => {
    expect(isRemovableUploadPath("products/peach/x.png")).toBe(true);
    expect(isRemovableUploadPath("seed/images/x.png")).toBe(false);
  });
  it("öffentliche URL mit kodierten Segmenten", () => {
    expect(
      buildPublicImageUrl("https://x.supabase.co/", "product-media", "seed/images/a b.png"),
    ).toBe("https://x.supabase.co/storage/v1/object/public/product-media/seed/images/a%20b.png");
  });
  it("Alt-Text mit Standard", () => {
    expect(altTextFor("", "Peach", 2)).toBe("Peach, Produktbild 2");
    expect(altTextFor(" Dose ", "Peach", 2)).toBe("Dose");
  });
  it("Reihenfolge muss vollständig sein", () => {
    expect(orderError(["a", "b"], ["b", "a"])).toBeNull();
    expect(orderError(["a", "b"], ["a"])).not.toBeNull();
    expect(orderError(["a", "b"], ["a", "a"])).not.toBeNull();
    expect(orderError(["a", "b"], ["a", "c"])).not.toBeNull();
  });
});
