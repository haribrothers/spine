import * as SQLite from "expo-sqlite";

/**
 * The phone's read cache (02-architecture §Offline): the last-fetched
 * assigned jobs, their milestones, photos and quotes, the person's own
 * expenses, Today's figures and notifications — one row per API read,
 * kept with the time it was fetched. Search reads it (US-MOB-23) and the
 * app shows it when there's no signal (US-MOB-07). Signing out clears it.
 */
export interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
}

export interface CacheBackend {
  get(key: string): Promise<{ value: string; fetchedAt: number } | null>;
  set(key: string, value: string, fetchedAt: number): Promise<void>;
  keys(prefix: string): Promise<string[]>;
  remove(keys: string[]): Promise<void>;
  clear(): Promise<void>;
}

function sqliteBackend(): CacheBackend {
  let db: Promise<SQLite.SQLiteDatabase> | null = null;
  const open = () =>
    (db ??= SQLite.openDatabaseAsync("spine-cache.db").then(async (conn) => {
      await conn.execAsync("CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, fetched_at INTEGER NOT NULL)");
      return conn;
    }));
  return {
    async get(key) {
      const row = await (await open()).getFirstAsync<{ value: string; fetched_at: number }>("SELECT value, fetched_at FROM cache WHERE key = ?", key);
      return row ? { value: row.value, fetchedAt: row.fetched_at } : null;
    },
    async set(key, value, fetchedAt) {
      await (await open()).runAsync("INSERT OR REPLACE INTO cache (key, value, fetched_at) VALUES (?, ?, ?)", key, value, fetchedAt);
    },
    async keys(prefix) {
      const rows = await (await open()).getAllAsync<{ key: string }>("SELECT key FROM cache WHERE substr(key, 1, ?) = ?", prefix.length, prefix);
      return rows.map((row) => row.key);
    },
    async remove(keys) {
      const conn = await open();
      for (const key of keys) await conn.runAsync("DELETE FROM cache WHERE key = ?", key);
    },
    async clear() {
      await (await open()).runAsync("DELETE FROM cache");
    },
  };
}

/** An in-memory backend, for tests. */
export function memoryBackend(): CacheBackend {
  const rows = new Map<string, { value: string; fetchedAt: number }>();
  return {
    get: async (key) => rows.get(key) ?? null,
    set: async (key, value, fetchedAt) => void rows.set(key, { value, fetchedAt }),
    keys: async (prefix) => [...rows.keys()].filter((key) => key.startsWith(prefix)),
    remove: async (keys) => keys.forEach((key) => rows.delete(key)),
    clear: async () => rows.clear(),
  };
}

let backend: CacheBackend | null = null;
const backendInUse = () => (backend ??= sqliteBackend());
const listeners = new Map<string, Set<() => void>>();
const notify = (key: string) => listeners.get(key)?.forEach((listener) => listener());

export const cache = {
  async read<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const row = await backendInUse().get(key);
      return row ? { value: JSON.parse(row.value) as T, fetchedAt: row.fetchedAt } : null;
    } catch {
      return null;
    }
  },
  async write<T>(key: string, value: T, fetchedAt: number = Date.now()): Promise<void> {
    try {
      await backendInUse().set(key, JSON.stringify(value), fetchedAt);
    } finally {
      notify(key);
    }
  },
  /** Every key that starts with `prefix`, e.g. `job:` for every cached job. */
  keys: (prefix: string) => backendInUse().keys(prefix),
  async remove(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await backendInUse().remove(keys);
    keys.forEach(notify);
  },
  async clear(): Promise<void> {
    try {
      await backendInUse().clear();
    } catch {
      // Nothing cached yet.
    }
    [...listeners.keys()].forEach(notify);
  },
  /** Called when `key` is written or removed. */
  subscribe(key: string, listener: () => void): () => void {
    const set = listeners.get(key) ?? new Set();
    set.add(listener);
    listeners.set(key, set);
    return () => set.delete(listener);
  },
  /** Tests swap in `memoryBackend()`. */
  setBackend(next: CacheBackend) {
    backend = next;
  },
};
