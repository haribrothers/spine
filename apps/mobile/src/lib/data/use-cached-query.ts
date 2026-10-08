import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { cache } from "../cache/cache-store";
import { OfflineError, ServerUnreachableError } from "../api/errors";
import { useSession } from "../session/session-provider";

/**
 * `loading` until the first answer; `ready` with fresh data; `offline` or
 * `unreachable` when the last refresh failed for that reason (cached data,
 * if any, is still in `data`); `error` for anything else.
 */
export type QueryStatus = "loading" | "ready" | "offline" | "unreachable" | "error";

export interface CachedQuery<T> {
  data: T | null;
  /** When `data` was fetched (ms), for "saved at <time>". */
  fetchedAt: number | null;
  status: QueryStatus;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

export interface CachedQueryOptions<T> {
  /** Runs after a successful fetch, before the cache is written (e.g. pruning jobs that left the list). */
  onFresh?: (value: T) => Promise<void> | void;
  /** Refetch when the app comes back to the foreground (D-200: notifications refresh then). */
  refreshOnForeground?: boolean;
  /** Skip the request (e.g. a module is off). The cache is still read. */
  enabled?: boolean;
}

/**
 * Cache first, then the network: shows what the phone last fetched for
 * `key` at once, asks the API for `path`, and writes the answer back. A
 * failed refresh keeps the cached data and says why.
 */
export function useCachedQuery<T>(key: string, path: string, options: CachedQueryOptions<T> = {}): CachedQuery<T> {
  const { request } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<QueryStatus>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const enabled = options.enabled !== false;

  const readCache = useCallback(async () => {
    const entry = await cache.read<T>(key);
    if (entry) {
      setData(entry.value);
      setFetchedAt(entry.fetchedAt);
    } else {
      setData(null);
      setFetchedAt(null);
    }
    return entry;
  }, [key]);

  const fetchFresh = useCallback(async () => {
    try {
      const value = await request<T>("GET", path);
      await optionsRef.current.onFresh?.(value);
      await cache.write(key, value);
      setStatus("ready");
    } catch (error) {
      setStatus(error instanceof OfflineError ? "offline" : error instanceof ServerUnreachableError ? "unreachable" : "error");
    }
  }, [key, path, request]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    void (async () => {
      const entry = await readCache();
      if (cancelled) return;
      if (enabled) await fetchFresh();
      else setStatus(entry ? "ready" : "error");
    })();
    return () => {
      cancelled = true;
    };
  }, [readCache, fetchFresh, enabled]);

  // Another screen (or this one) wrote the key: show it.
  useEffect(() => cache.subscribe(key, () => void readCache()), [key, readCache]);

  useEffect(() => {
    if (!options.refreshOnForeground || !enabled) return;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void fetchFresh();
    });
    return () => subscription.remove();
  }, [options.refreshOnForeground, enabled, fetchFresh]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setRefreshing(true);
    await fetchFresh();
    setRefreshing(false);
  }, [enabled, fetchFresh]);

  return { data, fetchedAt, status, refreshing, refresh };
}
