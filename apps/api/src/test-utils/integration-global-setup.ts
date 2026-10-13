import postgres from "postgres";
import { databaseName, integrationWorkers, maintenanceUrl, workerDatabaseName } from "./integration-databases";

/**
 * D-239 — before the integration run: one copy of the migrated test
 * database per worker (`CREATE DATABASE … TEMPLATE`, about a second each);
 * after it: the copies are dropped. The test database itself is migrated
 * beforehand, as before (`pnpm verify`, or CI's "Run DB migrations").
 */
export default async function setup(): Promise<() => Promise<void>> {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error("DATABASE_URL must name the migrated test database.");
  const base = databaseName(baseUrl);
  const workers = integrationWorkers();
  const sql = postgres(maintenanceUrl(baseUrl), { max: 1, onnotice: () => {} });
  const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
  const names = Array.from({ length: workers }, (_, i) => workerDatabaseName(base, i + 1));

  try {
    // A template can't be copied while anything is connected to it.
    await sql`select pg_terminate_backend(pid) from pg_stat_activity where datname = ${base} and pid <> pg_backend_pid()`;
    for (const name of names) {
      await sql.unsafe(`drop database if exists ${quote(name)} with (force)`);
      await sql.unsafe(`create database ${quote(name)} template ${quote(base)}`);
    }
  } finally {
    await sql.end();
  }

  return async () => {
    const done = postgres(maintenanceUrl(baseUrl), { max: 1, onnotice: () => {} });
    try {
      for (const name of names) await done.unsafe(`drop database if exists ${quote(name)} with (force)`);
    } finally {
      await done.end();
    }
  };
}
