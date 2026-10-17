import { describe, expect, it } from "vitest";
import { applySubjectTemplate, overrideSubject, subjectPlaceholders } from "./subject";

describe("applySubjectTemplate", () => {
  it("setzt Platzhalter ein und lässt unbekannte leer", () => {
    expect(
      applySubjectTemplate("Deine Bestellung {{order_number}} ist unterwegs", {
        order_number: "PV-10001",
      }),
    ).toBe("Deine Bestellung PV-10001 ist unterwegs");
    expect(
      applySubjectTemplate("Hallo {{ first_name }}, {{unbekannt}}schön", { first_name: "Lena" }),
    ).toBe("Hallo Lena, schön");
  });

  it("entfernt Zeilenumbrüche und kürzt auf 150 Zeichen", () => {
    expect(applySubjectTemplate("Zeile\r\nBcc: x@y.de")).toBe("Zeile Bcc: x@y.de");
    expect(applySubjectTemplate("x".repeat(200))).toHaveLength(150);
  });
});

describe("overrideSubject", () => {
  it("nutzt den gespeicherten Betreff, sonst den aus dem Code", () => {
    expect(overrideSubject("Willkommen bei provibe", "Schön, dass du da bist")).toBe(
      "Schön, dass du da bist",
    );
    expect(overrideSubject("Willkommen bei provibe", "  ")).toBe("Willkommen bei provibe");
    expect(overrideSubject("Willkommen bei provibe", null)).toBe("Willkommen bei provibe");
    expect(overrideSubject("Code", "{{leer}}")).toBe("Code");
  });

  it("listet Platzhalter", () => {
    expect(
      subjectPlaceholders("Neue Bestellung {{order_number}} über {{total}} {{order_number}}"),
    ).toEqual(["order_number", "total"]);
  });
});
