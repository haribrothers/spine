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
 * `TABLES` below only ever lists `public`-schema tables (Drizzle's own
 * migrated schema) — pg-boss (`QueueService`, PRD F3 Stage 2/3) manages a
 * wholly separate `pgboss` Postgres schema that this script previously
 * never touched at all, discovered live after a full reset still left old
 * `pgboss.job` rows (referencing orgs/quotes that no longer existed)
 * sitting untouched. `resetPgBossSchema()` below clears that schema's own
 * tables the same way, so "wipe my data" genuinely means all of it, not
 * just the Drizzle-migrated half.
 */
const TABLES = [
  "audit_log",
  "push_subscriptions",
  "notifications",
  "journal_lines",
  "journal_entries",
  "fiscal_periods",
  "accounts",
  "quote_public_tokens",
  "quote_events",
  "quote_lines",
  "quotes",
  "catalog_items",
  "leads",
  "activities",
  "addresses",
  "contact_persons",
  "contacts",
  "files",
  "idempotency_keys",
  "number_sequences",
  "settings",
  "invitation",
  "member",
  "session",
  "account",
  "verification",
  "jwks",
  "organization",
  "user",
];

/**
 * Truncates every table pg-boss owns in its own `pgboss` schema. Queried
 * dynamically (not a hardcoded list, unlike `TABLES` above) because pg-boss
 * creates dated partition tables for `queue_stats` (e.g.
 * `queue_stats_20260807`) on an ongoing basis — a fixed list would silently
 * miss whatever partitions exist by the time this runs. `pg_tables` is
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
  const quoted = TABLES.map((t) => `"${t}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`));
  const pgBossTableCount = await resetPgBossSchema(db);

  console.log(`Truncated ${TABLES.length} tables${pgBossTableCount ? ` + ${pgBossTableCount} pg-boss tables` : " (pg-boss schema not present, skipped)"}.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
