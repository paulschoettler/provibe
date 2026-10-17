import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { reviewsLd } from "./ld";
import {
  aggregateRatings,
  ANONYMOUS_AUTHOR,
  checkReviewToken,
  formatAverage,
  formatReviewDate,
  isoDateBerlin,
  reviewableItems,
  shortAuthorName,
  type OrderItemRow,
  type TokenOrder,
  type TokenRun,
} from "./logic";
import { reviewInputSchema } from "./schema";
import { hashReviewToken, isPlausibleReviewToken } from "./token";

const ORDER_ID = "6f1c2a52-1b9f-4c55-9e43-2f0b2e8c1a01";
const NOW = new Date("2026-10-17T12:00:00Z");

function run(overrides: Partial<TokenRun> = {}): TokenRun {
  return {
    automation_key: "review_request",
    target_type: "order",
    target_id: ORDER_ID,
    status: "sent",
    email: "Lena@Example.de",
    sent_at: "2026-10-10T08:00:00Z",
    created_at: "2026-10-10T07:00:00Z",
    ...overrides,
  };
}

function order(overrides: Partial<TokenOrder> = {}): TokenOrder {
  return {
    id: ORDER_ID,
    email: "lena@example.de",
    status: "delivered",
    delivered_at: "2026-10-03T10:00:00Z",
    ...overrides,
  };
}

describe("Token", () => {
  it("bildet den Hash wie die Automation (sha256 hex über den base64url-Token)", () => {
    const token = randomBytes(24).toString("base64url");
    expect(token).toHaveLength(32);
    expect(hashReviewToken(token)).toBe(createHash("sha256").update(token).digest("hex"));
    expect(isPlausibleReviewToken(token)).toBe(true);
  });

  it("verwirft offensichtlich kaputte Tokens vor jeder Abfrage", () => {
    expect(isPlausibleReviewToken("")).toBe(false);
    expect(isPlausibleReviewToken("kurz")).toBe(false);
    expect(isPlausibleReviewToken("a".repeat(129))).toBe(false);
    expect(isPlausibleReviewToken("abc def ghi jkl mno pqr stu")).toBe(false);
    expect(isPlausibleReviewToken(undefined)).toBe(false);
  });
});

describe("checkReviewToken", () => {
  it("akzeptiert einen passenden, verschickten Lauf zu einer zugestellten Bestellung", () => {
    const res = checkReviewToken({ run: run(), order: order(), now: NOW });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.expiresAt.toISOString()).toBe("2026-12-09T08:00:00.000Z");
  });

  it("lehnt unbekannte oder nicht verschickte Läufe ab", () => {
    expect(checkReviewToken({ run: null, order: order(), now: NOW })).toEqual({
      ok: false,
      reason: "unknown",
    });
    expect(
      checkReviewToken({ run: run({ status: "scheduled" }), order: order(), now: NOW }),
    ).toEqual({ ok: false, reason: "unknown" });
  });

  it("verlangt Automation, Zieltyp, Bestellung und E-Mail passend zueinander", () => {
    const mismatch = { ok: false, reason: "mismatch" };
    expect(
      checkReviewToken({ run: run({ automation_key: "welcome" }), order: order(), now: NOW }),
    ).toEqual(mismatch);
    expect(
      checkReviewToken({ run: run({ target_type: "cart" }), order: order(), now: NOW }),
    ).toEqual(mismatch);
    expect(checkReviewToken({ run: run(), order: order({ id: "anders" }), now: NOW })).toEqual(
      mismatch,
    );
    expect(checkReviewToken({ run: run(), order: null, now: NOW })).toEqual(mismatch);
    expect(
      checkReviewToken({ run: run(), order: order({ email: "jemand@anders.de" }), now: NOW }),
    ).toEqual(mismatch);
  });

  it("läuft 60 Tage nach dem Versand ab", () => {
    const sent = "2026-08-01T00:00:00Z";
    expect(
      checkReviewToken({
        run: run({ sent_at: sent }),
        order: order(),
        now: new Date("2026-09-30T00:00:00Z"),
      }).ok,
    ).toBe(true);
    expect(
      checkReviewToken({
        run: run({ sent_at: sent }),
        order: order(),
        now: new Date("2026-09-30T00:00:01Z"),
      }),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("nimmt created_at, wenn sent_at fehlt", () => {
    const res = checkReviewToken({
      run: run({ sent_at: null, created_at: "2026-07-01T00:00:00Z" }),
      order: order(),
      now: NOW,
    });
    expect(res).toEqual({ ok: false, reason: "expired" });
  });

  it("verlangt eine zugestellte, nicht stornierte Bestellung", () => {
    expect(
      checkReviewToken({
        run: run(),
        order: order({ status: "shipped", delivered_at: null }),
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "not_delivered" });
    expect(
      checkReviewToken({ run: run(), order: order({ status: "cancelled" }), now: NOW }),
    ).toEqual({
      ok: false,
      reason: "cancelled",
    });
    expect(
      checkReviewToken({ run: run(), order: order({ status: "refunded" }), now: NOW }),
    ).toEqual({
      ok: false,
      reason: "cancelled",
    });
    // Teilerstattung nach Zustellung bleibt bewertbar
    expect(
      checkReviewToken({ run: run(), order: order({ status: "partially_refunded" }), now: NOW }).ok,
    ).toBe(true);
  });
});

describe("reviewableItems", () => {
  const item = (o: Partial<OrderItemRow>): OrderItemRow => ({
    id: "i",
    product_id: "p",
    product_handle: "wildberry",
    product_title: "Wildberry",
    variant_title: "12 Dosen",
    image_path: null,
    quantity: 1,
    position: 0,
    ...o,
  });

  it("fasst Varianten eines Produkts zusammen und lässt Nicht-Produkte weg", () => {
    const items = reviewableItems([
      item({ id: "a", product_id: "wb", position: 1, variant_title: "12 Dosen" }),
      item({ id: "b", product_id: "wb", position: 0, variant_title: "24 Dosen" }),
      item({
        id: "c",
        product_id: "fb1",
        product_handle: "founder-bundle-i",
        product_title: "Founder Bundle I",
        variant_title: null,
        position: 2,
      }),
      item({ id: "d", product_id: null, product_title: "Gelöschtes Produkt", position: 3 }),
      item({ id: "e", product_id: "x", product_handle: null, product_title: "Pfand", position: 4 }),
      item({
        id: "f",
        product_id: "y",
        product_handle: "versand",
        product_title: "Versandkosten",
        position: 5,
      }),
    ]);
    expect(items.map((i) => i.productId)).toEqual(["wb", "fb1"]);
    expect(items[0]).toMatchObject({ orderItemId: "b", variantTitles: ["24 Dosen", "12 Dosen"] });
    expect(items[1]).toMatchObject({
      orderItemId: "c",
      handle: "founder-bundle-i",
      variantTitles: [],
    });
  });
});

describe("shortAuthorName", () => {
  it("kürzt auf Vorname und Initiale", () => {
    expect(shortAuthorName("Lena", "Müller")).toBe("Lena M.");
    expect(shortAuthorName("  anna   lena ", "schmidt")).toBe("Anna lena S.");
    expect(shortAuthorName("Celine", "von Grimm")).toBe("Celine G.");
    expect(shortAuthorName("Jonas", "")).toBe("Jonas");
    expect(shortAuthorName(null, "Özdemir")).toBe("Ö.");
    expect(shortAuthorName(null, null)).toBe(ANONYMOUS_AUTHOR);
  });
});

describe("aggregateRatings", () => {
  it("zählt, mittelt und verteilt, ungültige Werte zählen nicht", () => {
    const s = aggregateRatings([5, 5, 4, 3, 5, 0, 6, 4.5]);
    expect(s.count).toBe(5);
    expect(s.average).toBeCloseTo(4.4);
    expect(s.averageRounded).toBe(4.4);
    expect(s.distribution).toEqual({ 1: 0, 2: 0, 3: 1, 4: 1, 5: 3 });
    expect(formatAverage(s.averageRounded!)).toBe("4,4");
  });

  it("liefert ohne Bewertung null statt 0", () => {
    const s = aggregateRatings([]);
    expect(s).toMatchObject({ count: 0, average: null, averageRounded: null });
  });

  it("rundet auf eine Nachkommastelle", () => {
    expect(aggregateRatings([5, 5, 4]).averageRounded).toBe(4.7);
  });
});

describe("Datum", () => {
  it("zeigt Berliner Datum", () => {
    expect(formatReviewDate("2026-10-13T23:30:00Z")).toBe("14.10.2026");
    expect(isoDateBerlin("2026-10-13T23:30:00Z")).toBe("2026-10-14");
  });
});

describe("reviewInputSchema", () => {
  const base = {
    token: "a".repeat(32),
    productId: "9c75b257-7b40-5f5a-a786-cca9b5440fbb",
    rating: "4",
    title: "  Mein   Gym-Begleiter ",
    body: "Schmeckt nach Beeren und nicht nach Pulver.",
  };

  it("nimmt gültige Eingaben an und normalisiert", () => {
    const r = reviewInputSchema.parse(base);
    expect(r).toMatchObject({ rating: 4, title: "Mein Gym-Begleiter" });
  });

  it("leerer Titel wird null", () => {
    expect(reviewInputSchema.parse({ ...base, title: "   " }).title).toBeNull();
  });

  it("prüft Sterne, Titel- und Textlänge", () => {
    expect(reviewInputSchema.safeParse({ ...base, rating: "" }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...base, rating: "6" }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...base, rating: "3.5" }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...base, title: "x".repeat(81) }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...base, body: "zu kurz" }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...base, body: "x".repeat(1501) }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...base, body: "x".repeat(1500) }).success).toBe(true);
  });

  it("lehnt kaputte Tokens und Produkt-IDs ab", () => {
    expect(reviewInputSchema.safeParse({ ...base, token: "kurz" }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...base, productId: "wildberry" }).success).toBe(false);
  });

  it("entfernt Steuerzeichen, behält Zeilenumbrüche", () => {
    const r = reviewInputSchema.parse({
      ...base,
      body: "Erste Zeile\u0007 ist gut\r\n\r\n\r\nZweite Zeile ist auch gut",
    });
    expect(r.body).toBe("Erste Zeile ist gut\n\nZweite Zeile ist auch gut");
  });
});

describe("reviewsLd", () => {
  const review = {
    id: "r1",
    rating: 5,
    title: "Mein Gym-Begleiter",
    body: "Schmeckt nach Beeren.",
    authorName: "Lena M.",
    verified: true,
    createdAt: "2026-10-14T09:00:00Z",
    reply: null,
  };

  it("fügt ohne Bewertung nichts hinzu", () => {
    expect(reviewsLd(aggregateRatings([]), [])).toEqual({});
  });

  it("liefert AggregateRating und Review ab der ersten Bewertung", () => {
    const ld = reviewsLd(aggregateRatings([5, 4]), [
      review,
      { ...review, id: "r2", rating: 4, title: null },
    ]);
    expect(ld.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: "4.5",
      reviewCount: 2,
      bestRating: 5,
      worstRating: 1,
    });
    const reviews = ld.review as Record<string, unknown>[];
    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toMatchObject({
      "@type": "Review",
      author: { "@type": "Person", name: "Lena M." },
      datePublished: "2026-10-14",
      name: "Mein Gym-Begleiter",
      reviewRating: { "@type": "Rating", ratingValue: 5 },
    });
    expect(reviews[1]).not.toHaveProperty("name");
  });
});
