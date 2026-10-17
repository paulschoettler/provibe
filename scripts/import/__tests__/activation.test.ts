import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../lib/db";

/**
 * Massenversand der Aktivierungsmails: Vorlage "Konto aktivieren (Massenversand)" ohne Magic Link,
 * Allowlist bleibt Pflicht. mails.ts ist server-only und wird hier ersetzt.
 */
const sendBulkActivationMail = vi.fn(async (to: string) => ({
  status: "sent" as const,
  providerMessageId: `mock-${to}`,
}));
const sendActivationMail = vi.fn();

vi.mock("@/lib/auth/mails", () => ({ sendBulkActivationMail, sendActivationMail }));

const { sendActivationMails } = await import("../lib/activation");

function fakeDb() {
  const calls: { sql: string; params: unknown[] }[] = [];
  const db = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return { rows: [], rowCount: 1 };
    }),
  } as unknown as Db;
  return { db, calls };
}

const env = {
  APP_STAGE: "local",
  APP_INTEGRATIONS: "live",
  EMAIL_ALLOWLIST: "@provibe-drinks.de",
  NEXT_PUBLIC_SITE_URL: "https://shop.example/",
};

const candidates = [
  {
    customerId: "c1",
    email: "test-a@provibe-drinks.de",
    firstName: "Ada",
    activationEmailSentAt: null,
  },
  { customerId: "c2", email: "kundin@example.org", firstName: null, activationEmailSentAt: null },
  {
    customerId: "c3",
    email: "test-b@provibe-drinks.de",
    firstName: null,
    activationEmailSentAt: "2026-10-01T10:00:00.000Z",
  },
];

beforeEach(() => {
  sendBulkActivationMail.mockClear();
  sendActivationMail.mockClear();
});

describe("sendActivationMails", () => {
  it("nutzt die Massenvorlage, auch mit APP_INTEGRATIONS=live, nie einen Magic Link", async () => {
    const { db, calls } = fakeDb();
    const outcome = await sendActivationMails(
      db,
      candidates,
      { ratePerMinute: 120, resend: false, limit: null },
      env,
    );
    expect(sendActivationMail).not.toHaveBeenCalled();
    expect(sendBulkActivationMail).toHaveBeenCalledTimes(1);
    expect(sendBulkActivationMail).toHaveBeenCalledWith("test-a@provibe-drinks.de", "Ada", {
      siteUrl: "https://shop.example",
    });
    expect(outcome.activationPage).toBe("https://shop.example/account/konto-aktivieren");
    expect(outcome.sent).toBe(1);
    expect(outcome.blockedAllowlist).toBe(1);
    expect(outcome.alreadySent).toBe(1);
    expect(outcome.sentAt.has("c1")).toBe(true);
    const event = calls.find((c) => c.sql.includes("customer_events"));
    expect(JSON.parse(String(event?.params[1]))).toMatchObject({
      source: "import_shopify",
      template: "account_activate_bulk",
    });
  });

  it("Allowlist bleibt Pflicht, --resend schreibt bereits angeschriebene erneut an", async () => {
    const { db } = fakeDb();
    const outcome = await sendActivationMails(
      db,
      candidates,
      { ratePerMinute: 6000, resend: true, limit: null },
      env,
    );
    expect(sendBulkActivationMail.mock.calls.map((c) => c[0])).toEqual([
      "test-a@provibe-drinks.de",
      "test-b@provibe-drinks.de",
    ]);
    expect(outcome.blockedAllowlist).toBe(1);
  });
});
