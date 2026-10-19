import * as Network from "expo-network";
import { ACCESS_REMOVED_ERROR, CLIENT_TOO_OLD_ERROR, CLIENT_VERSION_HEADER, PASSWORD_CHANGE_REQUIRED_ERROR } from "@spine/shared/mobile";
import { AI_TIMEOUT_ERROR, AI_UNAVAILABLE_ERROR } from "@spine/shared/schemas";
import { APP_VERSION } from "../app-version";
import { AccessRemovedError, ApiError, CancelledError, OfflineError, PasswordChangeRequiredError, ServerUnreachableError, SessionExpiredError, UpdateRequiredError } from "./errors";

export type Method = "GET" | "POST" | "PUT" | "DELETE";

export interface RequestOptions {
  body?: unknown;
  /** A multipart body (`POST /files`); sent as is, with fetch setting the boundary. */
  formData?: FormData;
  /** Required by the API on every mutating route; the outbox reuses one key per item (Group 3). */
  idempotencyKey?: string;
  token?: string | null;
  timeoutMs?: number;
  /** Extra headers, e.g. none today — kept for the outbox. */
  headers?: Record<string, string>;
  /** US-AI-10 — aborting it stops the request, which then throws `CancelledError` ("Cancel" while AI reads a receipt). */
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/** True when the phone has a network connection; injectable for tests. */
export type OnlineCheck = () => Promise<boolean>;

export const isOnline: OnlineCheck = async () => {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected !== false && state.isInternetReachable !== false;
  } catch {
    return true;
  }
};

/**
 * One request to the Spine API: adds the bearer token and the client version
 * (D-071), times out, and turns every failure into one of the typed errors in
 * `./errors` so screens can tell offline, unreachable, too old, removed and
 * expired apart (US-MOB-10, US-MOB-02).
 */
export async function apiRequest<T>(
  apiBase: string,
  method: Method,
  path: string,
  options: RequestOptions = {},
  online: OnlineCheck = isOnline,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", [CLIENT_VERSION_HEADER]: APP_VERSION, ...options.headers };
  if (options.body !== undefined && !options.formData) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (method !== "GET" && options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const cancel = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", cancel);
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, {
      method,
      headers,
      body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      // Bearer only (D-016): no cookies, see sign-in.ts.
      credentials: "omit",
      signal: controller.signal,
    });
  } catch {
    if (options.signal?.aborted) throw new CancelledError();
    throw (await online()) ? new ServerUnreachableError() : new OfflineError();
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  let body: { message?: string; error?: string; minimumVersion?: string } | undefined;
  try {
    body = (await res.json()) as typeof body;
  } catch {
    body = undefined;
  }
  if (res.status === 426 || body?.error === CLIENT_TOO_OLD_ERROR) throw new UpdateRequiredError(body?.minimumVersion);
  if (res.status === 403 && body?.error === ACCESS_REMOVED_ERROR) throw new AccessRemovedError(body.message ?? "Your access was removed.");
  if (res.status === 403 && body?.error === PASSWORD_CHANGE_REQUIRED_ERROR) throw new PasswordChangeRequiredError(body.message ?? "Choose your own password to keep going.");
  if (res.status === 401) throw new SessionExpiredError();
  // US-AI-07: the server answered, but its AI provider didn't — "AI didn't answer…", not "the server didn't".
  if (body?.error === AI_UNAVAILABLE_ERROR || body?.error === AI_TIMEOUT_ERROR) throw new ApiError(body.message ?? "AI didn't answer.", res.status, body.error, body);
  if (res.status === 502 || res.status === 503 || res.status === 504) throw new ServerUnreachableError();
  throw new ApiError(body?.message ?? `Request failed (${res.status})`, res.status, body?.error, body);
}
