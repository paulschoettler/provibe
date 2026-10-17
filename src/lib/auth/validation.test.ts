import { describe, expect, it } from "vitest";
import {
  addressSchema,
  fieldErrorsOf,
  magicLinkSchema,
  profileSchema,
  registerSchema,
  setPasswordSchema,
} from "./validation";

const address = {
  firstName: "Paul",
  lastName: "Muster",
  company: "",
  street: "Musterstraße",
  houseNumber: "12",
  addressAddition: "",
  postalCode: "10115",
  city: "Berlin",
  countryCode: "DE",
  phone: "",
  label: "",
  isDefaultShipping: true,
  isDefaultBilling: false,
};

describe("magicLinkSchema", () => {
  it("normalisiert die E-Mail", () => {
    const r = magicLinkSchema.parse({ email: "  Paul@Beispiel.DE ", website: "" });
    expect(r.email).toBe("paul@beispiel.de");
  });
  it("erkennt den Honeypot", () => {
    expect(magicLinkSchema.safeParse({ email: "a@b.de", website: "bot" }).success).toBe(false);
  });
});

describe("Passwörter", () => {
  it("verlangt mindestens 10 Zeichen", () => {
    const r = setPasswordSchema.safeParse({ password: "kurz12345", passwordRepeat: "kurz12345" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrorsOf(r.error).password).toContain("10 Zeichen");
  });
  it("prüft die Wiederholung", () => {
    const r = registerSchema.safeParse({
      email: "a@b.de",
      password: "lang-genug-123",
      passwordRepeat: "anders-123456",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrorsOf(r.error).passwordRepeat).toBeDefined();
  });
  it("akzeptiert ein gültiges Passwort", () => {
    expect(
      setPasswordSchema.safeParse({ password: "lang-genug-123", passwordRepeat: "lang-genug-123" })
        .success,
    ).toBe(true);
  });
});

describe("profileSchema", () => {
  it("macht leere optionale Felder zu null", () => {
    const r = profileSchema.parse({ firstName: " Paul ", lastName: "", phone: "" });
    expect(r).toEqual({ firstName: "Paul", lastName: null, phone: null });
  });
  it("weist ungültige Telefonnummern ab", () => {
    expect(profileSchema.safeParse({ firstName: "P", lastName: "", phone: "abc" }).success).toBe(
      false,
    );
  });
});

describe("addressSchema", () => {
  it("akzeptiert eine deutsche Adresse", () => {
    const r = addressSchema.parse(address);
    expect(r.company).toBeNull();
    expect(r.id).toBeUndefined();
  });
  it("prüft die Postleitzahl je Land", () => {
    expect(addressSchema.safeParse({ ...address, postalCode: "1010" }).success).toBe(false);
    expect(
      addressSchema.safeParse({ ...address, postalCode: "1010", countryCode: "AT" }).success,
    ).toBe(true);
  });
  it("lehnt unbekannte Länder ab", () => {
    expect(addressSchema.safeParse({ ...address, countryCode: "FR" }).success).toBe(false);
  });
});
