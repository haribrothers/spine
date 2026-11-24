import { sql } from "drizzle-orm";
import { createDb } from "./client";

/**
 * Dev-only "clear the database" — truncates every app table in one
 * statement (Postgres TRUNCATE ... CASCADE handles FK ordering itself, so
 * no manual dependency-sorted list is needed) and restarts identity
 * sequences, without dropping the schema or requiring a migration replay.
 * Faster than `pnpm dev:infra:reset` (which tears down and recreates the
 * whole Postgres container) for the common "wipe my data, keep my schema"
 * case during local iteration.
 *
 * Deliberately not exposed as an API endpoint or wired into any app UI —
 * this drops ALL organisations/users, not just demo data (see
 * apps/api/src/modules/demo-data for the app-facing, org-scoped,
 * demo-only equivalent). CLI-only, guarded by requiring DATABASE_URL to
 * point somewhere and printing exactly what ran.
 *
 * Every table in the `public` schema is truncated, read from `pg_tables`
 * when it runs rather than kept as a list, so a table added by a later
 * migration is never left behind. Drizzle's own migration log lives in its
 * separate `drizzle` schema and is untouched, so no migration replays.
 * pg-boss (`QueueService`) keeps its jobs in its own `pgboss` schema;
 * `resetPgBossSchema()` below clears that too, so "wipe my data" genuinely
 * means all of it.
 */
async function resetPublicSchema(db: ReturnType<typeof createDb>): Promise<number> {
  const rows = await db.execute<{ tablename: string }>(sql.raw(`SELECT tablename FROM pg_tables WHERE schemaname = 'public';`));
  if (!rows.length) return 0;
  // One statement for the whole set: CASCADE and a single TRUNCATE leave the FK ordering to Postgres.
  const quoted = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`));
  return rows.length;
}

/**
 * Truncates every table pg-boss owns in its own `pgboss` schema. Queried
 * dynamically, like the public tables above, because pg-boss
 * creates dated partition tables for `queue_stats` (e.g.
 * `queue_stats_20260807`) on an ongoing basis. `pg_tables` is
 * queried directly against `information_schema` rather than assuming the
 * schema exists at all — a dev environment that has never booted the API
 * (so `QueueService.onModuleInit` never ran and created it) has no `pgboss`
 * schema yet, which must not be a hard error here.
 */
async function resetPgBossSchema(db: ReturnType<typeof createDb>): Promise<number> {
  const schemaExists = await db.execute(
    sql.raw(`SELECT 1 FROM information_schema.schemata WHERE schema_name = 'pgboss';`),
  );
  if (!schemaExists.length) return 0;

  const rows = await db.execute<{ tablename: string }>(
    sql.raw(`SELECT tablename FROM pg_tables WHERE schemaname = 'pgboss';`),
  );
  if (!rows.length) return 0;

  // Partition child tables (e.g. queue_stats_20260807) are truncated
  // implicitly when their partitioned parent is truncated with CASCADE, but
  // Postgres still requires every table named in a single TRUNCATE
  // statement to itself exist and be truncatable — truncating the full set
  // in one statement (rather than one at a time) keeps this atomic and
  // avoids ordering/locking issues between pg-boss's own FK'd tables.
  const quoted = rows.map((r) => `"pgboss"."${r.tablename}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`));
  return rows.length;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to reset the database");
  }

  const db = createDb(databaseUrl);
  const tableCount = await resetPublicSchema(db);
  const pgBossTableCount = await resetPgBossSchema(db);

  console.log(`Truncated ${tableCount} tables${pgBossTableCount ? ` + ${pgBossTableCount} pg-boss tables` : " (pg-boss schema not present, skipped)"}.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
