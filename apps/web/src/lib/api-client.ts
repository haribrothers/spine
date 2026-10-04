"use client";

/**
 * Thin browser-side fetch wrapper for `/org/*` endpoints — first of its
 * kind in apps/web (auth so far only used `authClient`/`get-session.ts`,
 * neither of which is a general API client). Always sends credentials
 * (cookie session) and, for mutating verbs, a fresh `Idempotency-Key` per
 * logical call so a network retry doesn't double-apply a write — matching
 * the pattern established API-side in
 * apps/api/src/common/idempotency.interceptor.ts.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Thrown instead of a plain `Error` so a caller that needs more than the
 * message string — e.g. QuoteConversionGuardService's 409 response, which
 * carries a structured `{ existing: {...} }` body the UI needs to render a
 * real confirmation dialog — can `instanceof ApiError` and read `.status`/
 * `.body`. Extends `Error` (not a bare class) specifically so every
 * existing `catch (err) { err instanceof Error ? err.message : ... }` call
 * site in this codebase keeps working completely unchanged — this is
 * additive, not a breaking change to the client's error shape.
 */
/** Fired on `window` when the API refuses an action (403); `PermissionToast` listens for it. */
export const FORBIDDEN_EVENT = "spine:forbidden";
export const FORBIDDEN_MESSAGE = "You don't have permission to do that. If you need to, ask an owner.";

/**
 * Fired on `window` when the API answers 401 (the session ended);
 * `SessionExpiredDialog` listens for it. `detail.mutation` is true for a
 * create, change or delete, which is never retried automatically.
 */
export const SESSION_EXPIRED_EVENT = "spine:session-expired";
export const SESSION_EXPIRED_MESSAGE = "You've been signed out. Log in again to save this change.";

function signalSessionExpired(mutation: boolean) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { mutation } }));
}

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

function idempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function request<T>(
  method: "GET" | "PUT" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (method !== "GET") {
    headers["Idempotency-Key"] = idempotencyKey();
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
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
    if (res.status === 403) {
      // US-OPS-12: a refusal is explained, never shown as a raw error.
      message = FORBIDDEN_MESSAGE;
      if (method !== "GET" && typeof window !== "undefined") window.dispatchEvent(new Event(FORBIDDEN_EVENT));
    }
    if (res.status === 401) {
      // US-AUTH-12: the page stays as it is; the dialog asks to log in again.
      if (method !== "GET") message = SESSION_EXPIRED_MESSAGE;
      signalSessionExpired(method !== "GET");
    }
    throw new ApiError(message, res.status, data);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

/**
 * Multipart upload — separate from `request()` since that always
 * JSON-stringifies the body and sets `Content-Type: application/json`,
 * neither of which is right for `multipart/form-data` (the browser must
 * set its own `Content-Type` with the multipart boundary; letting `fetch`
 * derive it from a `FormData` body, not setting it manually, is required).
 * Still sends a fresh `Idempotency-Key` per call, matching every other
 * mutating request.
 */
async function upload<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Idempotency-Key": idempotencyKey() },
    body: formData,
  });

  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const data = await res.json();
      message = data?.message ?? message;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    if (res.status === 403) {
      message = FORBIDDEN_MESSAGE;
      if (typeof window !== "undefined") window.dispatchEvent(new Event(FORBIDDEN_EVENT));
    }
    if (res.status === 401) {
      message = SESSION_EXPIRED_MESSAGE;
      signalSessionExpired(true);
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>("GET", path),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, file: File) => upload<T>(path, file),
};
