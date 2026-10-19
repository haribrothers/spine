import { AiProviderError, PROBE_PNG, PROBE_PROMPT, type AiCompletion, type AiDriver, type AiHttp, type AiPrompt, type AiProviderConfig } from "./ai-driver";

/**
 * D-163 — any server that speaks the OpenAI chat API: Ollama, vLLM and LM
 * Studio on the business's own network, or a cloud service. The key is
 * optional (a local server usually has none).
 */
export class OpenAiCompatibleDriver implements AiDriver {
  private readonly base: string;

  constructor(
    private readonly http: AiHttp,
    private readonly config: AiProviderConfig,
  ) {
    if (!config.baseUrl) throw new AiProviderError("there's no server address", "unreachable");
    this.base = config.baseUrl.replace(/\/+$/, "");
  }

  private get headers(): Record<string, string> {
    return this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {};
  }

  async listModels(): Promise<string[]> {
    const body = await this.http.json<{ data?: { id?: string }[] }>(`${this.base}/models`, { method: "GET", headers: this.headers });
    return (body.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string").sort((a, b) => a.localeCompare(b));
  }

  async ping(model: string, withImage: boolean): Promise<void> {
    const content = withImage
      ? [
          { type: "text", text: PROBE_PROMPT },
          { type: "image_url", image_url: { url: `data:image/png;base64,${PROBE_PNG}` } },
        ]
      : PROBE_PROMPT;
    await this.http.json(`${this.base}/chat/completions`, { method: "POST", headers: this.headers, body: { model, max_tokens: 1, messages: [{ role: "user", content }] } });
  }

  async complete(model: string, prompt: AiPrompt): Promise<AiCompletion> {
    const images = prompt.images ?? [];
    const content = images.length
      ? [{ type: "text", text: prompt.text }, ...images.map((image) => ({ type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.base64}` } }))]
      : prompt.text;
    const body = await this.http.json<{ choices?: { message?: { content?: unknown } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } }>(`${this.base}/chat/completions`, {
      method: "POST",
      headers: this.headers,
      body: { model, max_tokens: prompt.maxTokens, temperature: prompt.temperature ?? 0, messages: [{ role: "system", content: prompt.system }, { role: "user", content }] },
    });
    const answer = body.choices?.[0]?.message?.content;
    // Some servers answer with content parts instead of a string.
    const text = typeof answer === "string" ? answer : Array.isArray(answer) ? answer.map((part: { text?: string }) => part.text ?? "").join("") : "";
    return { text, usage: { input: body.usage?.prompt_tokens ?? 0, output: body.usage?.completion_tokens ?? 0 } };
  }
}
