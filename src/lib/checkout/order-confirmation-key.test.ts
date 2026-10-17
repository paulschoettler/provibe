import { describe, expect, it } from "vitest";
import { orderConfirmationIdempotencyKey } from "./emails";

const ORDER = "6f1c2b9e-0000-4000-8000-000000000001";

describe("Idempotenz-Schlüssel der Bestellbestätigung", () => {
  it("ist ohne force stabil je Bestellung, damit Job-Retries nicht doppelt senden", () => {
    expect(orderConfirmationIdempotencyKey(ORDER)).toBe(`order_confirmation:${ORDER}`);
    expect(orderConfirmationIdempotencyKey(ORDER, {}, 1)).toBe(
      orderConfirmationIdempotencyKey(ORDER, { force: false }, 2),
    );
  });

  it("bekommt mit force einen Zeitstempel und ist je Aufruf eindeutig", () => {
    const first = orderConfirmationIdempotencyKey(ORDER, { force: true }, 1_760_000_000_000);
    const second = orderConfirmationIdempotencyKey(ORDER, { force: true }, 1_760_000_000_001);
    expect(first).toBe(`order_confirmation:${ORDER}:erneut:1760000000000`);
    expect(first).not.toBe(second);
    expect(first.startsWith(orderConfirmationIdempotencyKey(ORDER))).toBe(true);
  });

  it("nutzt ohne übergebenen Zeitpunkt die aktuelle Zeit", () => {
    const before = Date.now();
    const key = orderConfirmationIdempotencyKey(ORDER, { force: true });
    const stamp = Number(key.split(":").pop());
    expect(stamp).toBeGreaterThanOrEqual(before);
    expect(stamp).toBeLessThanOrEqual(Date.now());
  });
});
