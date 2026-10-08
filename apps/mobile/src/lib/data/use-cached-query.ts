import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { cache } from "../cache/cache-store";
import { OfflineError, ServerUnreachableError } from "../api/errors";
import { useSession } from "../session/session-provider";
import { connectivity } from "../connectivity";

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
  /** Nothing to show yet: no cached copy and the first request is still out. Screens show a skeleton (D-201). */
  loading: boolean;
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

interface Snapshot<T> {
  key: string;
  data: T | null;
  fetchedAt: number | null;
  status: QueryStatus;
}

/**
 * Cache first, then the network: shows what the phone last fetched for
 * `key` at once, asks the API for `path`, and writes the answer back. A
 * failed refresh keeps the cached data and says why. State belongs to one
 * key: when the key changes (Today's period), the previous key's data is
 * never shown for the new one, and a late answer for an old key is ignored.
 */
export function useCachedQuery<T>(key: string, path: string, options: CachedQueryOptions<T> = {}): CachedQuery<T> {
  const { request } = useSession();
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({ key, data: null, fetchedAt: null, status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const keyRef = useRef(key);
  keyRef.current = key;
  const onFreshRef = useRef(options.onFresh);
  onFreshRef.current = options.onFresh;
  const enabled = options.enabled !== false;

  /** Updates the snapshot only while `forKey` is still the current key. */
  const update = useCallback((forKey: string, patch: Partial<Snapshot<T>>) => {
    if (keyRef.current !== forKey) return;
    setSnapshot((prev) => (prev.key === forKey ? { ...prev, ...patch } : { key: forKey, data: null, fetchedAt: null, status: "loading", ...patch }));
  }, []);

  const readCache = useCallback(async () => {
    const entry = await cache.read<T>(key);
    update(key, { data: entry?.value ?? null, fetchedAt: entry?.fetchedAt ?? null });
    return entry;
  }, [key, update]);

  const fetchFresh = useCallback(async () => {
    try {
      const value = await request<T>("GET", path);
      await onFreshRef.current?.(value);
      await cache.write(key, value);
      update(key, { status: "ready" });
    } catch (error) {
      update(key, { status: error instanceof OfflineError ? "offline" : error instanceof ServerUnreachableError ? "unreachable" : "error" });
    }
  }, [key, path, request, update]);

  useEffect(() => {
    let cancelled = false;
    setSnapshot({ key, data: null, fetchedAt: null, status: "loading" });
    void (async () => {
      const entry = await readCache();
      if (cancelled) return;
      if (enabled) await fetchFresh();
      else update(key, { status: entry ? "ready" : "error" });
    })();
    return () => {
      cancelled = true;
    };
  }, [key, readCache, fetchFresh, enabled, update]);

  // Another screen (or this one) wrote the key: show it.
  useEffect(() => cache.subscribe(key, () => void readCache()), [key, readCache]);

  useEffect(() => {
    if (!options.refreshOnForeground || !enabled) return;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void fetchFresh();
    });
    return () => subscription.remove();
  }, [options.refreshOnForeground, enabled, fetchFresh]);

  // US-MOB-07: back online, every screen showing saved data fetches it again.
  useEffect(() => {
    if (!enabled) return;
    let wasOnline = connectivity.get();
    return connectivity.subscribe(() => {
      const online = connectivity.get();
      if (online && !wasOnline) void fetchFresh();
      wasOnline = online;
    });
  }, [enabled, fetchFresh]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setRefreshing(true);
    await fetchFresh();
    setRefreshing(false);
  }, [enabled, fetchFresh]);

  // Until the effect above resets it, a snapshot from the previous key must not leak through.
  const current = snapshot.key === key ? snapshot : { key, data: null, fetchedAt: null, status: "loading" as const };
  return { data: current.data, fetchedAt: current.fetchedAt, status: current.status, loading: current.status === "loading" && current.data === null, refreshing, refresh };
}
