import { ANTHROPIC_HOST } from "@spine/shared";
import { AiProviderError, PROBE_PNG, PROBE_PROMPT, type AiDriver, type AiHttp, type AiProviderConfig } from "./ai-driver";

const BASE = `https://${ANTHROPIC_HOST}/v1`;
const VERSION = "2023-06-01";

/** D-163 — Anthropic's Messages API with the business's own key. */
export class AnthropicDriver implements AiDriver {
  constructor(
    private readonly http: AiHttp,
    private readonly config: AiProviderConfig,
  ) {
    if (!config.apiKey) throw new AiProviderError("there's no API key", "rejected");
  }

  private get headers(): Record<string, string> {
    return { "x-api-key": this.config.apiKey!, "anthropic-version": VERSION };
  }

  async listModels(): Promise<string[]> {
    const body = await this.http.json<{ data?: { id?: string }[] }>(`${BASE}/models?limit=100`, { method: "GET", headers: this.headers });
    return (body.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string");
  }

  async ping(model: string, withImage: boolean): Promise<void> {
    const content = withImage
      ? [
          { type: "image", source: { type: "base64", media_type: "image/png", data: PROBE_PNG } },
          { type: "text", text: PROBE_PROMPT },
        ]
      : PROBE_PROMPT;
    await this.http.json(`${BASE}/messages`, { method: "POST", headers: this.headers, body: { model, max_tokens: 1, messages: [{ role: "user", content }] } });
  }
}
