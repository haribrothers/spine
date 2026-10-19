import { createCanvas } from "@napi-rs/canvas";

/** A one-page PDF drawing `content` (a PDF content stream), with Helvetica available as /F1. Hand-built so tests need no PDF library. */
function onePagePdf(content: string): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

/** US-AI-08 — a vendor's bill as a PDF with a text layer, one line of text per entry. */
export function textBillPdf(lines: string[]): Buffer {
  const escape = (t: string) => t.replace(/[\\()]/g, (c) => `\\${c}`);
  const text = lines.map((line, i) => `BT /F1 11 Tf 50 ${790 - i * 18} Td (${escape(line)}) Tj ET`).join("\n");
  return onePagePdf(text);
}

/** A "scanned" bill: a PDF page with shapes and no text, so its page is sent as an image. */
export function scannedBillPdf(): Buffer {
  return onePagePdf("0.2 0.2 0.2 rg 50 700 300 40 re f 50 640 200 20 re f");
}

/** A small photo of a bill (a PNG). */
export function billPhoto(): Buffer {
  const canvas = createCanvas(320, 200);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 320, 200);
  ctx.fillStyle = "#222222";
  ctx.fillRect(20, 20, 200, 16);
  return canvas.toBuffer("image/png");
}
