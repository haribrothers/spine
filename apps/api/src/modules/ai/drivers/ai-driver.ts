import { Injectable } from "@nestjs/common";
import { AI_TIMEOUT_MS } from "@spine/shared";

/**
 * D-163 — the `AiDriver` interface, like `StorageDriver`: one per kind of
 * provider. The Owner brings the endpoint and key; Spine never supplies a
 * model. Every request goes through `AiHttp`, gives up after 30 seconds and
 * is never retried for a person waiting on it.
 */
export interface AiProviderConfig {
  driver: "openai-compatible" | "anthropic";
  baseUrl: string | null;
  model: string | null;
  apiKey: string | null;
}

export interface AiDriver {
  /** The models the provider lists. */
  listModels(): Promise<string[]>;
  /** A one-token reply from `model`; with a tiny image when `withImage`, to learn whether it reads images. */
  ping(model: string, withImage: boolean): Promise<void>;
}

/** Why a provider request failed, in words for "Couldn't reach <address>: <reason>." */
export class AiProviderError extends Error {
  constructor(
    readonly reason: string,
    /** `rejected`: the provider answered with an error (4xx), so it's reachable. */
    readonly kind: "unreachable" | "timeout" | "rejected",
  ) {
    super(reason);
  }
}

/** The one place Spine talks to an AI provider — spied on by the tests that prove nothing is sent while AI is off (D-164). */
@Injectable()
export class AiHttp {
  async json<T>(url: string, init: { method: "GET" | "POST"; headers: Record<string, string>; body?: unknown }): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: init.method,
        headers: { Accept: "application/json", ...(init.body === undefined ? {} : { "Content-Type": "application/json" }), ...init.headers },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      });
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === "TimeoutError" || name === "AbortError") throw new AiProviderError("no answer in 30 seconds", "timeout");
      // Node puts the reason on `cause`, or on each attempt when it tried several addresses.
      const cause = (err as { cause?: { code?: string; message?: string; errors?: { code?: string }[] } }).cause;
      const code = cause?.code ?? cause?.errors?.find((e) => e.code)?.code;
      const reason =
        code === "ECONNREFUSED" ? "the connection was refused" : code === "ENOTFOUND" ? "the address wasn't found" : cause?.message === "bad port" ? "that port can't be used" : "the server didn't respond";
      throw new AiProviderError(reason, "unreachable");
    }
    if (!res.ok) throw new AiProviderError(await failureReason(res), res.status >= 500 ? "unreachable" : "rejected");
    return (await res.json()) as T;
  }
}

async function failureReason(res: Response): Promise<string> {
  if (res.status === 401 || res.status === 403) return "the key was refused";
  if (res.status === 404) return "the model or address wasn't found";
  if (res.status === 429) return "the provider is busy or out of credit";
  let detail = "";
  try {
    const body = (await res.json()) as { error?: { message?: string } | string; message?: string };
    detail = typeof body.error === "string" ? body.error : (body.error?.message ?? body.message ?? "");
  } catch {
    // Not JSON: the status says enough.
  }
  return detail ? `${res.status} — ${detail.slice(0, 160)}` : `it answered ${res.status}`;
}

/** A 1×1 PNG, the smallest image a model can be asked to look at. */
export const PROBE_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
export const PROBE_PROMPT = "Reply with OK.";
