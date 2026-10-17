import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A stand-in OpenAI-compatible provider for the AI end-to-end tests
 * (US-AI-07, US-AI-08): the API under test calls it on 127.0.0.1. `down`
 * answers 500; otherwise chat completions answer the reply set last.
 */
export async function startAiStub() {
  let reply = "{}";
  let down = false;
  const server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      const send = (status: number, payload: unknown) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      };
      if (down) return send(500, { error: { message: "model failed to load" } });
      if (req.url === "/v1/models") return send(200, { data: [{ id: "qwen3-vl:8b" }] });
      if (req.url === "/v1/chat/completions") return send(200, { choices: [{ message: { content: reply } }], usage: { prompt_tokens: 3000, completion_tokens: 412 } });
      send(404, { error: { message: "Not found" } });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
    setReply: (value: unknown) => (reply = JSON.stringify(value)),
    setDown: (value: boolean) => (down = value),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** A one-page PDF with a text layer — a vendor's bill for AI to read. */
export function billPdf(lines: string[]): Buffer {
  const text = lines.map((line, i) => `BT /F1 11 Tf 50 ${790 - i * 18} Td (${line.replace(/[\\()]/g, (c) => `\\${c}`)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
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
