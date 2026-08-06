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
    try {
      const data = await res.json();
      message = data?.message ?? message;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>("GET", path),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
};
