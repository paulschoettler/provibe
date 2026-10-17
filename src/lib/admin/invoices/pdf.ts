/**
 * Minimales, gültiges PDF (eine A4-Seite, Helvetica, WinAnsi) als Platzhalter für Rechnungs-
 * entwürfe im Mock-Betrieb. Keine Bibliothek nötig; Umlaute werden als Latin-1 kodiert, alles
 * außerhalb von Latin-1 durch "?" ersetzt. Reine Funktion, getestet (xref-Offsets stimmen).
 */

function toLatin1(text: string): string {
  // Typografische Zeichen auf Latin-1 abbilden, Rest ersetzen
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/€/g, "EUR")
    .replace(/ | /g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function pdfString(text: string): string {
  return `(${toLatin1(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;
}

export interface PlaceholderPdfInput {
  title: string;
  lines: string[];
}

export function placeholderPdf(input: PlaceholderPdfInput): Buffer {
  const content: string[] = [
    "BT",
    "/F2 18 Tf",
    "56 780 Td",
    `${pdfString(input.title)} Tj`,
    "/F1 11 Tf",
    "0 -28 Td",
  ];
  for (const line of input.lines.slice(0, 50)) {
    content.push(`${pdfString(line)} Tj`, "0 -16 Td");
  }
  content.push("ET");
  const stream = content.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];

  let body = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += `${String(off).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}
