/**
 * D-239 — the integration suite runs its files in parallel, each worker
 * against its own copy of the migrated test database, so files never see
 * each other's rows (and the files that TRUNCATE shared tables only empty
 * their own worker's copy).
 */

/** Workers: `SPINE_TEST_WORKERS`, or 2 in CI (a 2-core runner shared with Postgres) and 4 locally. */
export function integrationWorkers(): number {
  const set = Number(process.env.SPINE_TEST_WORKERS);
  if (Number.isInteger(set) && set > 0) return set;
  return process.env.CI ? 2 : 4;
}

/** `postgres://…/spine_test` → `postgres://…/spine_test_w2`. */
export function workerDatabaseUrl(baseUrl: string, worker: number): string {
  const url = new URL(baseUrl);
  url.pathname = `/${workerDatabaseName(databaseName(baseUrl), worker)}`;
  return url.toString();
}

export function workerDatabaseName(base: string, worker: number): string {
  return `${base}_w${worker}`;
}

export function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}

/** The server's maintenance database, for creating and dropping the copies. */
export function maintenanceUrl(url: string): string {
  const u = new URL(url);
  u.pathname = "/postgres";
  return u.toString();
}
