import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Connections per pool and how long an idle one stays open. Unset in
 * production (postgres's own defaults: 10, kept open); the integration
 * tests set smaller ones so parallel workers stay under Postgres's
 * connection limit (D-239).
 */
export function poolSize(): number | undefined {
  const max = Number(process.env.DATABASE_POOL_MAX);
  return Number.isInteger(max) && max > 0 ? max : undefined;
}

function idleTimeout(): number | undefined {
  const seconds = Number(process.env.DATABASE_IDLE_TIMEOUT);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

export function createDb(connectionString: string) {
  const max = poolSize();
  const idle = idleTimeout();
  const client = postgres(connectionString, { ...(max ? { max } : {}), ...(idle ? { idle_timeout: idle } : {}) });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

/**
 * The `tx` handle drizzle-orm hands to a `db.transaction(async (tx) => ...)`
 * callback — structurally different from `Database` itself (drizzle types
 * it as `PgTransaction<...>`, not `PostgresJsDatabase<...>`), so anything
 * that needs to accept "either the top-level db or an open transaction"
 * (e.g. AuditLogService.record, which must join whatever transaction its
 * caller is already inside) needs this derived type rather than reusing
 * `Database` and hitting a structural mismatch.
 */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
