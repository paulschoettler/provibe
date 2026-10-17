import { describe, expect, it } from "vitest";
import {
  BULK_ACTIVATION_TEMPLATE,
  bulkActivationUrl,
  escapeHtml,
  renderBulkActivationMail,
} from "./account";

describe("bulkActivationUrl", () => {
  it("zeigt auf /account/konto-aktivieren mit kodierter E-Mail", () => {
    expect(bulkActivationUrl("https://www.provibe-drinks.de", "anna@example.org")).toBe(
      "https://www.provibe-drinks.de/account/konto-aktivieren?email=anna%40example.org",
    );
  });

  it("kodiert Sonderzeichen und entfernt Slash am Ende der Site-URL", () => {
    expect(bulkActivationUrl("https://shop.example/", " a+b&c=d@ex.de ")).toBe(
      "https://shop.example/account/konto-aktivieren?email=a%2Bb%26c%3Dd%40ex.de",
    );
  });
});

describe("renderBulkActivationMail", () => {
  const mail = renderBulkActivationMail({
    email: "test+1@provibe-drinks.de",
    firstName: "Celine",
    siteUrl: "https://www.provibe-drinks.de",
  });

  it("enthält keinen Ablaufhinweis und keinen Magic Link", () => {
    for (const body of [mail.html, mail.text]) {
      expect(body).not.toMatch(/15 Minuten|Minuten|gilt|abgelaufen|einmal/i);
      expect(body).not.toContain("token_hash");
      expect(body).not.toContain("/auth/callback");
    }
  });

  it("Button und Text zeigen auf die Aktivierungsseite", () => {
    expect(mail.url).toBe(
      "https://www.provibe-drinks.de/account/konto-aktivieren?email=test%2B1%40provibe-drinks.de",
    );
    expect(mail.html).toContain(`href="${mail.url}"`);
    expect(mail.html).toContain("Konto aktivieren");
    expect(mail.text).toContain(mail.url);
    expect(mail.subject).toBe("Dein provibe Konto ist bereit");
    expect(BULK_ACTIVATION_TEMPLATE).toBe("account_activate_bulk");
  });

  it("begrüßt mit Namen, ohne Namen neutral, Namen werden escaped", () => {
    expect(mail.html).toContain("Hallo Celine,");
    expect(mail.text.startsWith("Hallo Celine,")).toBe(true);
    const anon = renderBulkActivationMail({ email: "a@b.de", siteUrl: "https://x.de" });
    expect(anon.html).toContain("Hallo,");
    const evil = renderBulkActivationMail({
      email: "a@b.de",
      firstName: "<script>",
      siteUrl: "https://x.de",
    });
    expect(evil.html).not.toContain("<script>");
    expect(evil.html).toContain(escapeHtml("<script>"));
  });

  it("Impressum und Absender wie die übrigen Konto-Mails", () => {
    expect(mail.html).toContain("CG Projects UG (haftungsbeschränkt)");
    expect(mail.html).toContain('lang="de"');
  });
});
