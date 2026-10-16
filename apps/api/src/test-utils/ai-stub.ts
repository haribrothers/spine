import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";

export interface AiStubRequest {
  method: string;
  path: string;
  headers: IncomingMessage["headers"];
  body: unknown;
}

export interface AiStub {
  /** `http://127.0.0.1:<port>/v1` — a local address, so no acknowledgement is needed. */
  url: string;
  requests: AiStubRequest[];
  close: () => Promise<void>;
}

/**
 * A stand-in OpenAI-compatible provider for tests (US-AI-02): lists `models`,
 * answers chat completions, and refuses images when `acceptsImages` is
 * false, the way a text-only model does. Tests never call a real provider.
 */
export async function startAiStub(options: { models?: string[]; acceptsImages?: boolean; key?: string } = {}): Promise<AiStub> {
  const models = options.models ?? ["llama3.2-vision", "qwen2.5:14b"];
  const requests: AiStubRequest[] = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const body = raw ? JSON.parse(raw) : null;
      requests.push({ method: req.method ?? "", path: req.url ?? "", headers: req.headers, body });
      const send = (status: number, payload: unknown) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      };
      if (options.key && req.headers.authorization !== `Bearer ${options.key}`) return send(401, { error: { message: "Invalid API key" } });
      if (req.method === "GET" && req.url === "/v1/models") return send(200, { object: "list", data: models.map((id) => ({ id, object: "model" })) });
      if (req.method === "POST" && req.url === "/v1/chat/completions") {
        const content = (body as { messages?: { content?: unknown }[] })?.messages?.[0]?.content;
        const hasImage = Array.isArray(content) && content.some((c: { type?: string }) => c.type === "image_url");
        if (hasImage && options.acceptsImages === false) return send(400, { error: { message: "This model does not support image input" } });
        return send(200, { choices: [{ message: { role: "assistant", content: "OK" } }], usage: { prompt_tokens: 9, completion_tokens: 1 } });
      }
      send(404, { error: { message: "Not found" } });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/v1`, requests, close: () => new Promise((resolve) => server.close(() => resolve())) };
}
