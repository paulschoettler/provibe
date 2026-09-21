import type { CreateLabelInput, LabelRef, ShippingProvider } from "./types";

/**
 * DHL Parcel DE Shipping API (Post & Paket Deutschland, v2). Implementierung in Phase 7,
 * sobald API-Zugang, Benutzer und Abrechnungsnummer vorliegen. Sandbox zuerst.
 */
export class DhlShippingProvider implements ShippingProvider {
  readonly name = "dhl" as const;

  constructor(
    private config: {
      apiKey: string;
      username: string;
      password: string;
      billingNumber: string;
      environment: "sandbox" | "production";
    },
  ) {}

  async createLabel(_input: CreateLabelInput): Promise<LabelRef> {
    throw new Error("DhlShippingProvider: noch nicht implementiert (Phase 7)");
  }
  async cancelLabel(_shipmentNumber: string): Promise<void> {
    throw new Error("DhlShippingProvider: noch nicht implementiert (Phase 7)");
  }
  async createLabels(
    _inputs: CreateLabelInput[],
  ): Promise<{ labels: LabelRef[]; mergedPdf: Buffer }> {
    throw new Error("DhlShippingProvider: noch nicht implementiert (Phase 7)");
  }
  trackingUrl(shipmentNumber: string) {
    return `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${shipmentNumber}`;
  }
  protected baseUrl() {
    return this.config.environment === "production"
      ? "https://api-eu.dhl.com/parcel/de/shipping/v2"
      : "https://api-sandbox.dhl.com/parcel/de/shipping/v2";
  }
}
