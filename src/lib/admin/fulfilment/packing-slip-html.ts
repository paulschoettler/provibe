import { BRAND_COLORS as C, EMAIL_FONT_STACK } from "@/lib/brand/tokens";
import { escapeHtml, type LegalEntity } from "@/lib/checkout/emails";

/**
 * Lieferschein als druckfertiges HTML (A4, Druck-CSS), ohne PDF-Bibliothek: Der Browser druckt
 * oder speichert als PDF. Bewusst ohne Preise (Packliste fürs Lager), dafür mit SKU und
 * Bundle-Inhalt, damit beim Packen nichts fehlt. Reine Funktion, getestet.
 *
 * Datensparsam: keine E-Mail und keine Telefonnummer der Kundin. Der Zettel liegt im Paket und
 * wird vom Lager gedruckt (Rolle Fulfillment); DHL bekommt E-Mail und Telefon für die
 * Paketankündigung ausschließlich über die Label-Schnittstelle (shipments.ts), nicht über Papier.
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

function packingSlipSheet(data: PackingSlipData): string {
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

  return `<main class="sheet">
${data.isTest ? '<p class="test">TESTBESTELLUNG, nicht versenden</p>' : ""}
<header>
  <div>
    <p class="brand"><img src="/brand/logo/provibe-logo-wildberry.svg" alt="provibe" width="202" height="79"></p>
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
<footer>Kontakt bei Fragen: ${e(data.entity?.email ?? "hello@provibe-drinks.de")} · Bestellung ${e(data.orderNumber)}</footer>
</main>`;
}

const PACKING_SLIP_STYLES = `
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: ${EMAIL_FONT_STACK}; color: ${C.burgundy}; font-size: 12pt; margin: 0; }
  .sheet { max-width: 180mm; margin: 0 auto; padding: 16px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  h1 { font-size: 20pt; margin: 0 0 4px; }
  .brand { margin: 0; line-height: 0; }
  .brand img { display: block; width: auto; height: 9mm; }
  .sender { font-size: 8pt; color: ${C.wildberry}; margin: 24px 0 2px; text-decoration: underline; }
  .address { font-size: 12pt; line-height: 1.4; }
  .meta { font-size: 10pt; line-height: 1.6; text-align: right; }
  .muted { color: ${C.wildberry}; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th { text-align: left; font-size: 9pt; text-transform: uppercase; letter-spacing: .06em; color: ${C.wildberry}; border-bottom: 1.5px solid ${C.burgundy}; padding: 6px 4px; }
  td { border-bottom: 1px solid ${C.cream}; padding: 8px 4px; vertical-align: top; }
  td.qty { font-weight: 700; width: 14mm; text-align: right; padding-right: 10px; }
  td.check { width: 10mm; }
  .box { display: inline-block; width: 4mm; height: 4mm; border: 1.2px solid ${C.burgundy}; border-radius: 1mm; }
  .sku { font-family: ui-monospace, Menlo, monospace; font-size: 9pt; color: ${C.wildberry}; white-space: nowrap; }
  .components { margin: 4px 0 0; padding-left: 16px; font-size: 10pt; }
  .note { margin-top: 20px; padding: 10px 12px; border: 1px solid ${C.cream}; border-radius: 8px; font-size: 10pt; }
  .test { margin: 0 0 12px; padding: 6px 10px; background: ${C.lime_raspberry}; border: 1.5px solid ${C.wildberry}; color: ${C.wildberry}; border-radius: 8px; font-weight: 700; font-size: 10pt; }
  footer { margin-top: 28px; font-size: 9pt; color: ${C.wildberry}; }
  @media print { .sheet { padding: 0; } }
  .sheet + .sheet { break-before: page; page-break-before: always; margin-top: 32px; }
`;

function packingSlipDocument(title: string, sheets: string): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>${PACKING_SLIP_STYLES}</style>
</head>
<body>
${sheets}
</body>
</html>`;
}

export function renderPackingSlipHtml(data: PackingSlipData): string {
  return packingSlipDocument(`Lieferschein ${data.orderNumber}`, packingSlipSheet(data));
}

/** Mehrere Lieferscheine in einem Dokument, jeder auf einer eigenen Seite (Sammeldruck). */
export function renderPackingSlipsHtml(list: PackingSlipData[]): string {
  const title =
    list.length === 1 ? `Lieferschein ${list[0].orderNumber}` : `Lieferscheine (${list.length})`;
  return packingSlipDocument(title, list.map(packingSlipSheet).join("\n"));
}
