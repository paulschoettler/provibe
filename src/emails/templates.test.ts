import { describe, expect, it } from "vitest";
import { campaignBlocksSchema, renderCampaignEmail, resolveImageSrc } from "./campaign";
import { BRAND_COLORS } from "@/lib/brand/tokens";
import { escapeHtml, htmlToText, safeUrl, textParagraphs } from "./components";
import { CRM_TEMPLATE_KEYS, renderCrmTemplate } from "./index";

const entity = {
  name: "CG Projects UG (haftungsbeschränkt)",
  street: "Kurt-Viermetz-Straße 1a",
  zip: "86150",
  city: "Augsburg",
  email: "hello@provibe-drinks.de",
  managingDirector: "Celine Grimm",
  register: "Amtsgericht Augsburg, HRB 41818",
  vatId: "DE457662597",
};
const ctx = {
  entity,
  siteUrl: "https://shop.example",
  imageBaseUrl: "https://cdn.example/media",
  unsubscribeUrl: "https://shop.example/newsletter/abmelden?token=abc",
};

describe("Bausteine", () => {
  it("escaped Texte und erlaubt nur sichere Links", () => {
    expect(escapeHtml(`<script>"x"</script>`)).toBe("&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
    expect(safeUrl("javascript:alert(1)", "https://shop.example")).toBe("https://shop.example");
    expect(safeUrl("/cart", "https://shop.example/")).toBe("https://shop.example/cart");
    expect(safeUrl("mailto:hello@provibe-drinks.de", "x")).toBe("mailto:hello@provibe-drinks.de");
  });

  it("teilt Text in Absätze und Zeilen", () => {
    expect(textParagraphs("Eins\nzwei\n\n<b>Drei</b>")).toEqual([
      "Eins<br>zwei",
      "&lt;b&gt;Drei&lt;/b&gt;",
    ]);
  });

  it("löst Bildquellen auf", () => {
    expect(resolveImageSrc("seed/a.png", "https://s", "https://cdn/media/")).toBe(
      "https://cdn/media/seed/a.png",
    );
    expect(resolveImageSrc("/hero.png", "https://s", "x")).toBe("https://s/hero.png");
    expect(resolveImageSrc("https://x/y.png", "https://s", "x")).toBe("https://x/y.png");
  });

  it("macht aus HTML lesbaren Text mit Links", () => {
    expect(htmlToText(`<p>Hallo <a href="https://x">Link</a></p><p>Zwei &amp; drei</p>`)).toBe(
      "Hallo Link (https://x)\nZwei & drei",
    );
  });
});

describe("Kampagne", () => {
  it("validiert Blöcke und verlangt Alt-Texte und sichere Links", () => {
    expect(
      campaignBlocksSchema.safeParse([{ id: "1", type: "image", src: "a.png", alt: "" }]).success,
    ).toBe(false);
    expect(
      campaignBlocksSchema.safeParse([
        { id: "1", type: "button", label: "Los", href: "javascript:alert(1)" },
      ]).success,
    ).toBe(false);
    const ok = campaignBlocksSchema.parse([{ id: "1", type: "text", body: "Hallo" }]);
    expect(ok[0]).toEqual({ id: "1", type: "text", heading: "", body: "Hallo" });
  });

  it("rendert Blöcke mit Pflichtfuß, Abmeldelink und Impressum", () => {
    const mail = renderCampaignEmail({
      subject: "Peach ist zurück",
      preheader: "15 g Protein",
      blocks: [
        { id: "1", type: "text", heading: "Peach <3", body: "Text" },
        { id: "2", type: "product", productHandle: "peach" },
        { id: "3", type: "product", productHandle: "unbekannt" },
        { id: "4", type: "button", label: "Los", href: "/products/peach" },
        { id: "5", type: "divider" },
      ],
      products: {
        peach: {
          title: "Peach",
          line: "Eistee",
          priceLine: "9 Dosen 26,10 €",
          detailLine: null,
          imageUrl: null,
          url: "https://shop.example/products/peach",
        },
      },
      ...ctx,
    });
    expect(mail.subject).toBe("Peach ist zurück");
    expect(mail.html).toContain("Peach &lt;3");
    expect(mail.html).toContain("9 Dosen 26,10 €");
    expect(mail.html).toContain('href="https://shop.example/products/peach"');
    expect(mail.html).toContain(ctx.unsubscribeUrl);
    expect(mail.html).toContain("CG Projects UG (haftungsbeschränkt)");
    expect(mail.html).toContain("USt-IdNr.: DE457662597");
    // Schriftstapel mit Rückfall (Filson lädt im Mailclient nicht), CI-Farben aus tokens.json
    expect(mail.html).toContain("Helvetica Neue', Arial, sans-serif");
    expect(mail.html).toContain(`color:${BRAND_COLORS.wildberry}`);
    expect(mail.html).toContain(`background:${BRAND_COLORS.cream}`);
    expect(mail.html).toContain("/brand/logo-derived/provibe-logo-wildberry@2x.png");
    expect(mail.html).not.toMatch(/style="[^"]*"[a-z-]+"/);
    expect(mail.html).not.toContain("unbekannt");
    expect(mail.text).toContain("Abmelden (https://shop.example/newsletter/abmelden?token=abc)");
  });
});

describe("Register", () => {
  it("rendert jede CRM-Vorlage mit Abmeldelink und Impressum", () => {
    for (const key of CRM_TEMPLATE_KEYS) {
      const mail = renderCrmTemplate(key, { first_name: "<Paul>" }, ctx);
      expect(mail.subject.length).toBeGreaterThan(3);
      expect(mail.html).toContain(ctx.unsubscribeUrl);
      expect(mail.html).toContain("Kurt-Viermetz-Straße 1a");
      expect(mail.html).not.toContain("<Paul>");
    }
  });

  it("zeigt Testhinweis und Bewertungslink", () => {
    const mail = renderCrmTemplate(
      "review_request",
      { order_number: "PV-10007", review_url: "https://shop.example/bewerten?token=t" },
      { ...ctx, testBanner: "TESTVERSAND" },
    );
    expect(mail.html).toContain("TESTVERSAND");
    expect(mail.html).toContain("PV-10007");
    expect(mail.html).toContain("https://shop.example/bewerten?token=t");
  });
});
