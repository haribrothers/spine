import * as SQLite from "expo-sqlite";
import type { OutboxItem } from "./types";

/**
 * Where outbox items live: SQLite on the phone (they must survive the app
 * being killed), one JSON row per item, plus who they belong to. Tests use
 * `memoryOutboxBackend()`.
 */
export interface OutboxBackend {
  load(): Promise<{ items: OutboxItem[]; owner: string | null }>;
  put(item: OutboxItem): Promise<void>;
  remove(id: string): Promise<void>;
  setOwner(owner: string | null): Promise<void>;
  clear(): Promise<void>;
}

export function sqliteOutboxBackend(): OutboxBackend {
  let db: Promise<SQLite.SQLiteDatabase> | null = null;
  const open = () =>
    (db ??= SQLite.openDatabaseAsync("spine-outbox.db").then(async (conn) => {
      await conn.execAsync(
        "CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY NOT NULL, created_at INTEGER NOT NULL, item TEXT NOT NULL); CREATE TABLE IF NOT EXISTS outbox_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT)",
      );
      return conn;
    }));
  return {
    async load() {
      const conn = await open();
      const rows = await conn.getAllAsync<{ item: string }>("SELECT item FROM outbox ORDER BY created_at");
      const owner = await conn.getFirstAsync<{ value: string | null }>("SELECT value FROM outbox_meta WHERE key = 'owner'");
      return { items: rows.map((row) => JSON.parse(row.item) as OutboxItem), owner: owner?.value ?? null };
    },
    async put(item) {
      await (await open()).runAsync("INSERT OR REPLACE INTO outbox (id, created_at, item) VALUES (?, ?, ?)", item.id, item.createdAt, JSON.stringify(item));
    },
    async remove(id) {
      await (await open()).runAsync("DELETE FROM outbox WHERE id = ?", id);
    },
    async setOwner(owner) {
      await (await open()).runAsync("INSERT OR REPLACE INTO outbox_meta (key, value) VALUES ('owner', ?)", owner);
    },
    async clear() {
      await (await open()).runAsync("DELETE FROM outbox");
    },
  };
}

export function memoryOutboxBackend(): OutboxBackend {
  const rows = new Map<string, OutboxItem>();
  let owner: string | null = null;
  return {
    load: async () => ({ items: [...rows.values()].sort((a, b) => a.createdAt - b.createdAt).map((item) => structuredClone(item)), owner }),
    put: async (item) => void rows.set(item.id, structuredClone(item)),
    remove: async (id) => void rows.delete(id),
    setOwner: async (next) => void (owner = next),
    clear: async () => rows.clear(),
  };
}
