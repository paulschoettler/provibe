import type { OrderView } from "@/lib/checkout/order-view";

/**
 * Beispielbestellung für die Vorschau der Checkout-Vorlagen im Backoffice. Die Vorlagen selbst
 * liegen in src/lib/checkout/emails.ts und werden nur aufgerufen, nicht dupliziert.
 * Keine echten Kundendaten.
 */
export function sampleOrderView(siteUrl: string, orderNumber = "PV-10001"): OrderView {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    orderNumber,
    email: "max.muster@example.com",
    placedAt: "2026-10-17T12:32:00.000Z",
    paidAt: "2026-10-17T12:32:30.000Z",
    paymentStatus: "paid",
    paymentLabel: "Karte, Visa endet auf 4242",
    items: [
      {
        title: "Peach Eistee",
        description: "9 Dosen",
        quantity: 1,
        displayTotalCents: 2610,
        unitPriceCents: 2385,
        unitDepositCents: 225,
        basePriceText: "8,03 € / l",
        imageUrl: `${siteUrl}/product-media/seed/images/provibe-peach.png`,
      },
      {
        title: "Founder Bundle I",
        description: "Limitiertes Set",
        quantity: 1,
        displayTotalCents: 3580,
        unitPriceCents: 3430,
        unitDepositCents: 150,
        basePriceText: null,
        imageUrl: null,
      },
    ],
    itemCount: 2,
    subtotalCents: 5815,
    discountCents: 0,
    discountCode: null,
    depositCents: 375,
    depositLabel: "Pfand (15 × 0,25 €)",
    shippingCents: 0,
    shippingName: "DHL Paket",
    shippingFree: true,
    deliveryTimeText: "3–5 Werktage",
    taxLines: [{ rateBp: 1900, grossCents: 6190, taxCents: 988 }],
    taxCents: 988,
    totalCents: 6190,
    shippingAddress: {
      first_name: "Max",
      last_name: "Muster",
      company: null,
      street: "Beispielstraße",
      house_number: "12",
      address_addition: null,
      postal_code: "86150",
      city: "Augsburg",
      country_code: "DE",
      phone: null,
    },
    billingAddress: null,
    legalVersionIds: [],
    isTest: true,
    marketingOptIn: false,
  };
}
