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
 */
const TABLES = [
  "audit_log",
  "journal_lines",
  "journal_entries",
  "fiscal_periods",
  "accounts",
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

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to reset the database");
  }

  const db = createDb(databaseUrl);
  const quoted = TABLES.map((t) => `"${t}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`));

  console.log(`Truncated ${TABLES.length} tables.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
