import type { CreateLabelInput, LabelRef, ShippingProvider } from "./types";

export class MockShippingProvider implements ShippingProvider {
  readonly name = "mock" as const;
  readonly labels: (LabelRef & { input: CreateLabelInput })[] = [];
  private seq = 0;

  async createLabel(input: CreateLabelInput): Promise<LabelRef> {
    const shipmentNumber = `0034043333${String(++this.seq).padStart(10, "0")}`;
    const ref: LabelRef = {
      shipmentNumber,
      trackingUrl: this.trackingUrl(shipmentNumber),
      labelPdf: Buffer.from(
        `%PDF-1.4\n% mock label ${shipmentNumber} for ${input.orderNumber}\n%%EOF\n`,
      ),
      ...(input.withReturnLabel
        ? {
            returnShipmentNumber: `RET${shipmentNumber}`,
            returnLabelPdf: Buffer.from(`%PDF-1.4\n% mock return\n%%EOF\n`),
          }
        : {}),
    };
    this.labels.push({ ...ref, input });
    return ref;
  }

  async cancelLabel(shipmentNumber: string) {
    const i = this.labels.findIndex((l) => l.shipmentNumber === shipmentNumber);
    if (i >= 0) this.labels.splice(i, 1);
  }

  async createLabels(inputs: CreateLabelInput[]) {
    const labels = [];
    for (const input of inputs) labels.push(await this.createLabel(input));
    return {
      labels,
      mergedPdf: Buffer.from(`%PDF-1.4\n% mock merged ${labels.length} labels\n%%EOF\n`),
    };
  }

  trackingUrl(shipmentNumber: string) {
    return `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${shipmentNumber}`;
  }
}
