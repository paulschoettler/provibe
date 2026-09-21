export interface ShipmentAddress {
  name1: string;
  name2?: string;
  street: string;
  houseNumber?: string;
  addressAddition?: string;
  postalCode: string;
  city: string;
  countryCode: string; // ISO 3166-1 alpha-2, DHL erwartet alpha-3 intern
  email?: string;
  phone?: string;
}

export interface CreateLabelInput {
  orderNumber: string;
  shipmentId: string;
  recipient: ShipmentAddress;
  weightGrams: number;
  /** DHL Produkt, z.B. V01PAK (Paket), V62KP (Kleinpaket) */
  product: string;
  /** Rücksendelabel gleich mit erzeugen */
  withReturnLabel?: boolean;
  /** Format: PDF A4 mit mehreren Labels (Sammeldruck) oder 910-300-700 (Einzel) */
  labelFormat?: "910-300-700" | "A4";
}

export interface LabelRef {
  shipmentNumber: string;
  trackingUrl: string;
  labelPdf: Buffer;
  returnLabelPdf?: Buffer;
  returnShipmentNumber?: string;
}

export interface ShippingProvider {
  readonly name: "dhl" | "mock";
  createLabel(input: CreateLabelInput): Promise<LabelRef>;
  cancelLabel(shipmentNumber: string): Promise<void>;
  /** Mehrere Labels als ein PDF (Sammeldruck) */
  createLabels(inputs: CreateLabelInput[]): Promise<{ labels: LabelRef[]; mergedPdf: Buffer }>;
  trackingUrl(shipmentNumber: string): string;
}
