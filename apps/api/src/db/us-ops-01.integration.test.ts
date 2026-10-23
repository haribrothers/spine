import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIGRATIONS_FOLDER, migrateOnStart } from "./migrate-on-start";

/** US-OPS-01 (D-264) — a fresh install creates its tables when the API starts. Requires local Postgres (and CREATE DATABASE). */
describe("US-OPS-01 · the API brings the database up to date at start (requires local Postgres)", () => {
  const base = new URL(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  const name = `us_ops_01_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const fresh = new URL(base);
  fresh.pathname = `/${name}`;
  const admin = postgres(base.toString(), { max: 1, onnotice: () => {} });

  beforeAll(async () => {
    await admin.unsafe(`create database ${name}`);
  });

  afterAll(async () => {
    await admin.unsafe(`drop database if exists ${name} with (force)`);
    await admin.end();
  });

  it("on an empty database, applies every migration and creates the tables", async () => {
    const result = await migrateOnStart(fresh.toString());
    expect(result.applied).toBe(result.total);
    expect(result.total).toBeGreaterThan(100);
    const db = postgres(fresh.toString(), { max: 1 });
    const [row] = await db<{ n: number }[]>`select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name in ('organization', 'invoices', 'journal_entries', 'agent_requests')`;
    await db.end();
    expect(row?.n).toBe(4);
  }, 120_000);

  it("on an up-to-date database, applies nothing", async () => {
    await expect(migrateOnStart(fresh.toString())).resolves.toMatchObject({ applied: 0 });
  });

  it("two API containers starting together on an empty database: one migrates, the other waits and finds nothing to do", async () => {
    const other = `${name}_b`;
    const url = new URL(base);
    url.pathname = `/${other}`;
    await admin.unsafe(`create database ${other}`);
    try {
      const results = await Promise.all([migrateOnStart(url.toString()), migrateOnStart(url.toString())]);
      expect(results.map((r) => r.applied).sort((a, b) => a - b)).toEqual([0, results[0]!.total]);
    } finally {
      await admin.unsafe(`drop database if exists ${other} with (force)`);
    }
  }, 120_000);

  it("ships the migrations next to the API's build", () => {
    expect(MIGRATIONS_FOLDER).toMatch(/apps\/api\/drizzle$/);
  });
});
