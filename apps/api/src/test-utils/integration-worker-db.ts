import { workerDatabaseUrl } from "./integration-databases";

/**
 * D-239 — runs before each integration test file: points `DATABASE_URL`
 * at this worker's own copy of the test database, before the app, Better
 * Auth or a test opens a connection.
 */
const base = process.env.SPINE_TEST_BASE_DATABASE_URL ?? process.env.DATABASE_URL;
const worker = Number(process.env.VITEST_POOL_ID ?? "1");
if (base) {
  process.env.SPINE_TEST_BASE_DATABASE_URL = base;
  process.env.DATABASE_URL = workerDatabaseUrl(base, worker);
}
// Smaller pools that let idle connections go, so every worker's app, Better Auth, pg-boss
// and test connections fit under Postgres's limit of 100 together.
process.env.DATABASE_POOL_MAX ??= "5";
process.env.DATABASE_IDLE_TIMEOUT ??= "2";
