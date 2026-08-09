import { sql } from "drizzle-orm";
import { createDb } from "./client";

/**
 * Manual, ad-hoc sanity check — not part of the migration itself and not
 * wired into CI. Reports any organisation that doesn't have exactly one
 * Primary Owner (0022_backfill_primary_owner_and_default_team.sql's own
 * "at least one exists" invariant depends on every org having had at least
 * one active `role='owner'` member row at backfill time — an org that
 * somehow had zero would silently get none, which the DB's partial unique
 * index alone can't catch since it only enforces "at most one").
 *
 * Run manually after applying the backfill migration:
 *   pnpm --filter api exec tsx src/db/verify-primary-owners.ts
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const db = createDb(databaseUrl);
  const rows = await db.execute<{ organization_id: string; primary_owner_count: number }>(
    sql`
      SELECT organization_id, COUNT(*) FILTER (WHERE is_primary_owner) AS primary_owner_count
      FROM member
      GROUP BY organization_id
      HAVING COUNT(*) FILTER (WHERE is_primary_owner) != 1
    `,
  );

  if (rows.length === 0) {
    console.log("OK — every organisation has exactly one Primary Owner.");
    process.exit(0);
  }

  console.error(`Found ${rows.length} organisation(s) without exactly one Primary Owner:`);
  for (const row of rows) {
    console.error(`  org ${row.organization_id}: ${row.primary_owner_count} primary owner(s)`);
  }
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
