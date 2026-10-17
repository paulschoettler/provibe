import { describe, expect, it } from "vitest";
import { CUSTOMER_CSV_HEADER, csvCell, customersToCsv } from "./csv-export";

describe("customersToCsv", () => {
  it("schreibt Semikolon-CSV mit BOM, Euro mit Komma und Datum als Tag", () => {
    const csv = customersToCsv([
      {
        id: "c1",
        name: "Lena Hoffmann",
        email: "lena@beispiel.de",
        customerType: "b2c",
        companyName: null,
        ordersCount: 4,
        totalSpentCents: 21460,
        lastOrderAt: "2026-10-02T08:00:00.000Z",
        createdAt: "2026-01-05T08:00:00.000Z",
        newsletterStatus: "Abonniert",
        tags: ["Stammkunde", "Peach"],
        accountStatus: "aktiv",
        acquisitionSource: "instagram",
      },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    const [head, row] = csv.slice(1).trim().split("\r\n");
    expect(head.split(";")).toEqual(CUSTOMER_CSV_HEADER);
    expect(row).toBe(
      "c1;Lena Hoffmann;lena@beispiel.de;B2C;;4;214,60;2026-10-02;2026-01-05;Abonniert;Stammkunde, Peach;aktiv;instagram",
    );
  });

  it("entschärft Formeln und quotet Trenner", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell('Firma; "Süd"')).toBe('"Firma; ""Süd"""');
    expect(csvCell(null)).toBe("");
  });
});
