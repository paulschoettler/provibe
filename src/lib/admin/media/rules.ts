import { z } from "zod";

/**
 * Reine Regeln für Produktbilder (Paket Admin-Katalog): Dateityp an den ersten Bytes erkennen
 * (nicht dem Browser glauben), Größe prüfen, Abmessungen aus dem Dateikopf lesen,
 * Speicherpfad aus Handle und Inhalts-Hash bilden, öffentliche URL bauen.
 *
 * Bildverarbeitung: Es werden nur Originale gespeichert. AVIF/WebP und responsive Größen
 * erzeugt next/image über das Netlify Image CDN (next.config.ts, images.formats). sharp wird zur
 * Laufzeit bewusst nicht verwendet, siehe Bericht und ADR-Vorschlag.
 */

export const PRODUCT_MEDIA_BUCKET = "product-media";

/** Obergrenze je Bild. Der Bucket erlaubt 25 MB, für Produktfotos reichen 10 MB. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MIN_IMAGE_EDGE = 200;
export const MAX_IMAGE_EDGE = 12000;

export const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;
export type ImageMime = keyof typeof IMAGE_TYPES;

/** Präfix für hochgeladene Bilder; seed/ (Shopify-Import) wird nie gelöscht. */
export const UPLOAD_PREFIX = "products";
export const PENDING_PREFIX = "uploads";
/** Kollektionsbilder (Kopfbild der Kollektionsseite) */
export const COLLECTION_PREFIX = "collections";

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let s = "";
  for (let i = start; i < start + length && i < bytes.length; i++)
    s += String.fromCharCode(bytes[i]);
  return s;
}

/** Dateityp anhand der Signatur. Nur die vier erlaubten Bildformate. */
export function sniffImageType(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a
  )
    return "image/png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP")
    return "image/webp";
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (brand === "avif" || brand === "avis") return "image/avif";
    // kompatible Marken im ftyp-Kasten
    const boxSize = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    for (let i = 16; i + 4 <= Math.min(boxSize, bytes.length); i += 4) {
      if (ascii(bytes, i, 4) === "avif") return "image/avif";
    }
  }
  return null;
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b: Uint8Array, i: number) =>
  ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];

/** Breite und Höhe aus dem Dateikopf, ohne Bildbibliothek. null, wenn nicht lesbar. */
export function readImageSize(
  bytes: Uint8Array,
  type: ImageMime,
): { width: number; height: number } | null {
  try {
    if (type === "image/png") {
      if (ascii(bytes, 12, 4) !== "IHDR") return null;
      return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
    }
    if (type === "image/jpeg") {
      let i = 2;
      while (i + 9 < bytes.length) {
        if (bytes[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = bytes[i + 1];
        if (marker === 0xff) {
          i++;
          continue;
        }
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          i += 2;
          continue;
        }
        const len = u16be(bytes, i + 2);
        const isSof =
          marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isSof) return { height: u16be(bytes, i + 5), width: u16be(bytes, i + 7) };
        i += 2 + len;
      }
      return null;
    }
    if (type === "image/webp") {
      const chunk = ascii(bytes, 12, 4);
      if (chunk === "VP8X") return { width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 };
      if (chunk === "VP8L") {
        const b0 = bytes[21];
        const b1 = bytes[22];
        const b2 = bytes[23];
        const b3 = bytes[24];
        return {
          width: 1 + (((b1 & 0x3f) << 8) | b0),
          height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
        };
      }
      if (chunk === "VP8 ")
        return { width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff };
      return null;
    }
    // AVIF: erster ispe-Kasten (image spatial extents)
    for (let i = 0; i + 16 <= bytes.length; i++) {
      if (bytes[i] === 0x69 && ascii(bytes, i, 4) === "ispe") {
        return { width: u32be(bytes, i + 8), height: u32be(bytes, i + 12) };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export interface ImageCheck {
  type: ImageMime;
  extension: string;
  width: number | null;
  height: number | null;
}

/**
 * Prüfung vor dem Speichern: Größe, erkannter Typ (muss zum angegebenen passen, falls einer
 * angegeben ist), Abmessungen in sinnvollen Grenzen.
 */
export function checkImage(
  bytes: Uint8Array,
  declaredType?: string | null,
): { ok: true; image: ImageCheck } | { ok: false; error: string } {
  if (bytes.length === 0) return { ok: false, error: "Die Datei ist leer." };
  if (bytes.length > MAX_IMAGE_BYTES)
    return { ok: false, error: "Die Datei ist größer als 10 MB. Bitte verkleinere das Bild." };
  const type = sniffImageType(bytes);
  if (!type) return { ok: false, error: "Erlaubt sind JPEG, PNG, WebP und AVIF." };
  const declared = declaredType === "image/jpg" ? "image/jpeg" : declaredType;
  if (declared && declared !== "application/octet-stream" && declared !== type) {
    return { ok: false, error: "Dateiendung und Inhalt passen nicht zusammen." };
  }
  const size = readImageSize(bytes, type);
  if (size) {
    const min = Math.min(size.width, size.height);
    const max = Math.max(size.width, size.height);
    if (min < MIN_IMAGE_EDGE)
      return {
        ok: false,
        error: `Das Bild ist zu klein (mindestens ${MIN_IMAGE_EDGE} Pixel je Seite).`,
      };
    if (max > MAX_IMAGE_EDGE) return { ok: false, error: "Das Bild ist zu groß (Kantenlänge)." };
  }
  return {
    ok: true,
    image: {
      type,
      extension: IMAGE_TYPES[type],
      width: size?.width ?? null,
      height: size?.height ?? null,
    },
  };
}

/** Lesbarer Dateiname aus dem Original ("Peach Dose (2).PNG" → "peach-dose-2"). */
export function fileStem(fileName: string): string {
  const base = fileName.replace(/\.[a-z0-9]{2,5}$/i, "");
  return (
    base
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "bild"
  );
}

/**
 * Speicherpfad: products/<handle>/<handle>-<hash12>.<ext>. Der Hash (SHA-256 des Inhalts)
 * macht den Namen eindeutig und erkennt doppelte Uploads; der Handle macht ihn lesbar für SEO
 * und im Bucket.
 */
export function imageStoragePath(handle: string, sha256Hex: string, extension: string): string {
  return `${UPLOAD_PREFIX}/${handle}/${handle}-${sha256Hex.slice(0, 12)}.${extension}`;
}

/** Zwischenablage für direkte Browser-Uploads per signierter URL (vor der Prüfung). */
export function pendingUploadPath(handle: string, token: string, fileName: string): string {
  return `${PENDING_PREFIX}/${handle}/${token}-${fileStem(fileName)}`;
}

/** Speicherpfad eines Kollektionsbilds: collections/<handle>/<handle>-<hash12>.<ext> */
export function collectionImagePath(handle: string, sha256Hex: string, extension: string): string {
  return `${COLLECTION_PREFIX}/${handle}/${handle}-${sha256Hex.slice(0, 12)}.${extension}`;
}

export function isRemovableUploadPath(path: string): boolean {
  return (
    path.startsWith(`${UPLOAD_PREFIX}/`) ||
    path.startsWith(`${PENDING_PREFIX}/`) ||
    path.startsWith(`${COLLECTION_PREFIX}/`)
  );
}

/** Öffentliche URL im Supabase-Storage (Bucket product-media ist öffentlich lesbar). */
export function buildPublicImageUrl(supabaseUrl: string, bucket: string, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${encoded}`;
}

/** Alt-Text als jsonb {"de": "..."}; leer wird zu "<Titel>, Produktbild <n>" (WCAG 1.1.1). */
export function altTextFor(
  alt: string | null | undefined,
  productTitle: string,
  n: number,
): string {
  const v = (alt ?? "").trim();
  return v || `${productTitle}, Produktbild ${n}`;
}

export const altSchema = z.string().trim().max(250, "Bitte höchstens 250 Zeichen.");

export const imageOrderSchema = z.array(z.guid()).min(1).max(100);

/** Neue Reihenfolge prüfen: genau die vorhandenen Bilder, jedes einmal. */
export function orderError(current: string[], next: string[]): string | null {
  if (new Set(next).size !== next.length) return "Ein Bild steht doppelt in der Reihenfolge.";
  if (next.length !== current.length || next.some((id) => !current.includes(id)))
    return "Die Reihenfolge passt nicht zu den Bildern des Produkts. Bitte lade die Seite neu.";
  return null;
}
