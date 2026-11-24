"use client";

import { useCallback, useState } from "react";
import { notFound } from "next/navigation";
import { ApiError } from "./api-client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * US-OPS-11, US-OPS-13 — a record page's first load. An id that can't be a
 * record, or a 404 (not in this organisation), shows the 404 page; a server
 * error (5xx) shows the error page with its request id. Anything else (a
 * dropped connection, a refusal) returns false, so the page says it itself:
 *
 *   const loadFailed = useLoadFailure(id);
 *   apiClient.get(...).then(setX).catch((err) => loadFailed(err) || setError(...));
 */
export function useLoadFailure(id: string): (err: unknown) => boolean {
  const [failure, setFailure] = useState<"missing" | Error | null>(UUID.test(id) ? null : "missing");
  const loadFailed = useCallback((err: unknown) => {
    if (!(err instanceof ApiError)) return false;
    if (err.status === 404) {
      setFailure("missing");
      return true;
    }
    if (err.status >= 500) {
      setFailure(err);
      return true;
    }
    return false;
  }, []);
  if (failure === "missing") notFound();
  if (failure) throw failure;
  return loadFailed;
}
