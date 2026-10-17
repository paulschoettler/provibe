import { escapeHtml, type LegalEntity } from "@/lib/checkout/emails";

/**
 * Lieferschein als druckfertiges HTML (A4, Druck-CSS), ohne PDF-Bibliothek: Der Browser druckt
 * oder speichert als PDF. Bewusst ohne Preise (Packliste fürs Lager), dafür mit SKU und
 * Bundle-Inhalt, damit beim Packen nichts fehlt. Reine Funktion, getestet.
 */

export interface PackingSlipItem {
  title: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  components: { title: string; sku: string | null; quantity: number }[] | null;
}

export interface PackingSlipData {
  orderNumber: string;
  placedAt: string;
  shippingAddressLines: string[];
  billingAddressLines: string[] | null;
  email: string;
  shippingName: string | null;
  items: PackingSlipItem[];
  customerNote: string | null;
  isTest: boolean;
  entity: LegalEntity | null;
}

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function renderPackingSlipHtml(data: PackingSlipData): string {
  const e = escapeHtml;
  const placed = dateFormat.format(new Date(data.placedAt));
  const totalUnits = data.items.reduce((s, i) => s + i.quantity, 0);
  const rows = data.items
    .map((i) => {
      const components =
        i.components && i.components.length > 0
          ? `<ul class="components">${i.components
              .map(
                (c) =>
                  `<li>${i.quantity * c.quantity} × ${e(c.title)}${c.sku ? ` <span class="sku">${e(c.sku)}</span>` : ""}</li>`,
              )
              .join("")}</ul>`
          : "";
      return `<tr>
<td class="check"><span class="box"></span></td>
<td class="qty">${i.quantity}</td>
<td><strong>${e(i.title)}</strong>${i.variantTitle ? `<br><span class="muted">${e(i.variantTitle)}</span>` : ""}${components}</td>
<td class="sku">${i.sku ? e(i.sku) : ""}</td>
</tr>`;
    })
    .join("\n");
  const entity = data.entity
    ? `<p class="sender">${e(data.entity.name)} · ${e(data.entity.street)} · ${e(data.entity.zip)} ${e(data.entity.city)}</p>`
    : "";

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<title>Lieferschein ${e(data.orderNumber)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Jost, Helvetica, Arial, sans-serif; color: #1A1A1A; font-size: 12pt; margin: 0; }
  .sheet { max-width: 180mm; margin: 0 auto; padding: 16px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  h1 { font-size: 20pt; margin: 0 0 4px; }
  .brand { font-size: 11pt; letter-spacing: .24em; text-transform: uppercase; font-weight: 600; color: #4A2F39; }
  .sender { font-size: 8pt; color: #616161; margin: 24px 0 2px; text-decoration: underline; }
  .address { font-size: 12pt; line-height: 1.4; }
  .meta { font-size: 10pt; line-height: 1.6; text-align: right; }
  .muted { color: #616161; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th { text-align: left; font-size: 9pt; text-transform: uppercase; letter-spacing: .06em; color: #616161; border-bottom: 1.5px solid #1A1A1A; padding: 6px 4px; }
  td { border-bottom: 1px solid #E3E3E3; padding: 8px 4px; vertical-align: top; }
  td.qty { font-weight: 700; width: 14mm; text-align: right; padding-right: 10px; }
  td.check { width: 10mm; }
  .box { display: inline-block; width: 4mm; height: 4mm; border: 1.2px solid #1A1A1A; border-radius: 1mm; }
  .sku { font-family: ui-monospace, Menlo, monospace; font-size: 9pt; color: #4B5563; white-space: nowrap; }
  .components { margin: 4px 0 0; padding-left: 16px; font-size: 10pt; }
  .note { margin-top: 20px; padding: 10px 12px; border: 1px solid #E3E3E3; border-radius: 8px; font-size: 10pt; }
  .test { margin: 0 0 12px; padding: 6px 10px; border: 1.5px solid #B7791F; color: #87570F; border-radius: 8px; font-weight: 600; font-size: 10pt; }
  footer { margin-top: 28px; font-size: 9pt; color: #616161; }
  @media print { .sheet { padding: 0; } }
</style>
</head>
<body>
<main class="sheet">
${data.isTest ? '<p class="test">TESTBESTELLUNG, nicht versenden</p>' : ""}
<header>
  <div>
    <p class="brand">provibe</p>
    ${entity}
    <div class="address">${data.shippingAddressLines.map(e).join("<br>")}</div>
  </div>
  <div class="meta">
    <h1>Lieferschein</h1>
    Bestellung <strong>${e(data.orderNumber)}</strong><br>
    Bestelldatum ${placed}<br>
    ${data.shippingName ? `Versand ${e(data.shippingName)}<br>` : ""}
    ${totalUnits} Artikel
  </div>
</header>
<table>
  <thead><tr><th></th><th>Menge</th><th>Artikel</th><th>SKU</th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>
${data.customerNote ? `<div class="note"><strong>Hinweis zur Bestellung:</strong> ${e(data.customerNote)}</div>` : ""}
${
  data.billingAddressLines
    ? `<p class="muted" style="margin-top:20px">Rechnungsadresse: ${data.billingAddressLines.map(e).join(", ")}</p>`
    : ""
}
<footer>Kontakt bei Fragen: ${e(data.entity?.email ?? "hello@provibe-drinks.de")} · Bestellung ${e(data.orderNumber)} · ${e(data.email)}</footer>
</main>
</body>
</html>`;
}
