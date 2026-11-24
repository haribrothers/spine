/**
 * A thin, hand-written fetch layer — not a generated request client.
 * Mirrors `apps/web/src/lib/api-client.ts`'s shape (its `ApiError` class,
 * its JSON/error-handling logic) with two changes for the mobile
 * offline-outbox use case that motivated building `packages/sdk` at all
 * (see the Phase 5 plan): auth is a `Bearer` token, not a cookie, and the
 * `Idempotency-Key` is CALLER-SUPPLIED rather than generated fresh per
 * call — the outbox generates one UUID at queue-time and reuses it across
 * every replay attempt, matching `apps/api/src/common/idempotency.
 * interceptor.ts`'s exact contract (same key -> same endpoint -> the
 * stored response is replayed, not re-executed).
 *
 * Heavier generated-client-with-behavior approaches (orval, openapi-fetch's
 * own client wrapper) were deliberately not used — this hand-written layer
 * is the natural place for the outbox's idempotency-key-reuse and
 * bearer-token-refresh concerns to live without fighting a generated
 * client's own request lifecycle. `./types` (this package's other export)
 * is the actual typed contract; this file only needs it for the
 * `paths`/`operations` helper types below.
 */
import type { paths } from "./generated/openapi.d.ts";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  /** Returns the current bearer token (a freshly-minted JWT, per the mobile auth-flow design — re-minted from the stored session on every app foreground/near-expiry) or null if unauthenticated. */
  getToken: () => string | null | Promise<string | null>;
}

type Method = "GET" | "PUT" | "POST" | "DELETE";

/**
 * Path/method pairs are typed via `paths` (generated), but the response/
 * request-body shape isn't threaded through generically here — every
 * caller still gives its own `<T>` at the call site (matching
 * `apps/web/src/lib/api-client.ts`'s own untyped-by-default shape) since
 * fully deriving it from `paths[P][M]` for every verb/path combination
 * adds real complexity for marginal benefit while the SDK is this young;
 * revisit once more of the surface is decorated and callers actually want
 * the stricter inference.
 */
export function createApiClient(config: ApiClientConfig) {
  async function request<T>(method: Method, path: keyof paths & string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const token = await config.getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (method !== "GET" && idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    const res = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      let data: unknown;
      try {
        data = await res.json();
        const parsed = data as { message?: string } | undefined;
        message = parsed?.message ?? message;
      } catch {
        // response wasn't JSON — keep the generic message
      }
      throw new ApiError(message, res.status, data);
    }

    if (res.status === 204) {
      return undefined as T;
    }
    return (await res.json()) as T;
  }

  return {
    get: <T>(path: keyof paths & string) => request<T>("GET", path),
    put: <T>(path: keyof paths & string, body?: unknown, idempotencyKey?: string) => request<T>("PUT", path, body, idempotencyKey),
    post: <T>(path: keyof paths & string, body?: unknown, idempotencyKey?: string) => request<T>("POST", path, body, idempotencyKey),
    delete: <T>(path: keyof paths & string, idempotencyKey?: string) => request<T>("DELETE", path, undefined, idempotencyKey),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
