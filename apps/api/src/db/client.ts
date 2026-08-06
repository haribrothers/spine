import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(connectionString: string) {
  const client = postgres(connectionString);
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
