import { describe, expect, it, vi } from "vitest";
import { AiProviderError, type AiHttp } from "./ai-driver";
import { OpenAiCompatibleDriver } from "./openai-compatible.driver";

const answer = { choices: [{ message: { content: '{"subject":"Hi"}' } }], usage: { prompt_tokens: 240, completion_tokens: 30 } };
const prompt = { system: "Write it.", text: "The email", maxTokens: 1500 };
const driverOn = (baseUrl: string, json: ReturnType<typeof vi.fn>) => new OpenAiCompatibleDriver({ json } as unknown as AiHttp, { driver: "openai-compatible", baseUrl, model: "qwen3.5:4b", apiKey: null });
const sent = (json: ReturnType<typeof vi.fn>, call: number) => (json.mock.calls[call]![1] as { body: Record<string, unknown> }).body;

/** US-AI-02 (D-255) — a "thinking" model is asked not to think, so it answers inside the 30 seconds. */
describe("US-AI-02 · a thinking model on an OpenAI-compatible server", () => {
  it("asks the model not to think", async () => {
    const json = vi.fn().mockResolvedValue(answer);
    expect(await driverOn("http://ollama.local:11434/v1", json).complete("qwen3.5:4b", prompt)).toEqual({ text: '{"subject":"Hi"}', usage: { input: 240, output: 30 } });
    expect(sent(json, 0)).toMatchObject({ model: "qwen3.5:4b", reasoning_effort: "none", temperature: 0 });
  });

  it("a server that refuses the parameter is asked again without it, once, and never sent it again", async () => {
    const json = vi.fn().mockRejectedValueOnce(new AiProviderError("400 — Unsupported parameter: 'reasoning_effort' is not supported with this model.", "rejected")).mockResolvedValue(answer);
    const driver = driverOn("https://api.example.com/v1", json);
    expect((await driver.complete("qwen3.5:4b", prompt)).text).toBe('{"subject":"Hi"}');
    expect(sent(json, 0)).toHaveProperty("reasoning_effort");
    expect(sent(json, 1)).not.toHaveProperty("reasoning_effort");
    await driver.complete("qwen3.5:4b", prompt);
    expect(json).toHaveBeenCalledTimes(3);
    expect(sent(json, 2)).not.toHaveProperty("reasoning_effort");
  });

  it("any other refusal, or no answer, isn't asked again (US-AI-07)", async () => {
    const refused = vi.fn().mockRejectedValue(new AiProviderError("400 — model not loaded", "rejected"));
    await expect(driverOn("http://vllm.local/v1", refused).complete("qwen3.5:4b", prompt)).rejects.toThrow("model not loaded");
    expect(refused).toHaveBeenCalledTimes(1);
    const slow = vi.fn().mockRejectedValue(new AiProviderError("no answer in 30 seconds", "timeout"));
    await expect(driverOn("http://slow.local/v1", slow).complete("qwen3.5:4b", prompt)).rejects.toThrow("no answer in 30 seconds");
    expect(slow).toHaveBeenCalledTimes(1);
  });
});
