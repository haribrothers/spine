import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/** Any two API containers starting together take this lock in turn, so one migrates and the other finds nothing to do. */
const MIGRATION_LOCK = 7_301_042;

/** Where the migrations ship: `apps/api/drizzle`, next to `dist/`. */
export const MIGRATIONS_FOLDER = resolve(__dirname, "../../drizzle");

export interface MigrationResult {
  applied: number;
  total: number;
}

/**
 * US-OPS-01 (D-264) — brings the database up to date before the API serves
 * anything: a fresh install creates its tables, an upgrade applies what's
 * new. Runs Drizzle's migrator (the same files and journal `drizzle-kit
 * migrate` uses) on its own connection, holding a Postgres advisory lock.
 */
export async function migrateOnStart(databaseUrl: string, folder = MIGRATIONS_FOLDER): Promise<MigrationResult> {
  const total = (JSON.parse(readFileSync(join(folder, "meta", "_journal.json"), "utf8")) as { entries: unknown[] }).entries.length;
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await client`select pg_advisory_lock(${MIGRATION_LOCK})`;
    const applied = async () => {
      const [row] = await client<{ n: number }[]>`select count(*)::int as n from drizzle.__drizzle_migrations`.catch(() => [{ n: 0 }]);
      return row?.n ?? 0;
    };
    const before = await applied();
    await migrate(drizzle(client), { migrationsFolder: folder });
    return { applied: (await applied()) - before, total };
  } finally {
    await client`select pg_advisory_unlock(${MIGRATION_LOCK})`.catch(() => {});
    await client.end();
  }
}
