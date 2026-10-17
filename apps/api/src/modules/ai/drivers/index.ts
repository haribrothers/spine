import type { AiDriver, AiHttp, AiProviderConfig } from "./ai-driver";
import { AnthropicDriver } from "./anthropic.driver";
import { OpenAiCompatibleDriver } from "./openai-compatible.driver";

export { AiHttp, AiProviderError, type AiCompletion, type AiDriver, type AiPrompt, type AiProviderConfig } from "./ai-driver";

/** The driver for a provider. `none` has no driver: with no provider, nothing is ever sent. */
export function createAiDriver(http: AiHttp, config: AiProviderConfig): AiDriver {
  return config.driver === "anthropic" ? new AnthropicDriver(http, config) : new OpenAiCompatibleDriver(http, config);
}
