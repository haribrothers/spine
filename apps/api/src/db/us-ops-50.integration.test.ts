import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pgTool } from "../test-utils/pg-tools";
import { MIGRATIONS_FOLDER, MigrationError, SNAPSHOTS_KEPT, migrateOnStart } from "./migrate-on-start";

/** US-OPS-50 (D-264) — an upgrade's migrations run after a snapshot, and a failed one changes nothing. Requires local Postgres (CREATE DATABASE) and pg_dump 16. */
describe("US-OPS-50 · upgrade Spine with one command: migrations at start (requires local Postgres)", () => {
  const base = new URL(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  const name = `us_ops_50_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const url = new URL(base);
  url.pathname = `/${name}`;
  const admin = postgres(base.toString(), { max: 1, onnotice: () => {} });
  const snapshots = mkdtempSync(join(tmpdir(), "us-ops-50-snapshots-"));
  const pgDump = pgTool("pg_dump");
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8")) as { entries: { idx: number; when: number; tag: string }[] };
  const lastWhen = journal.entries[journal.entries.length - 1]!.when;
  const extra: string[] = [];

  /** The next version's migrations: this repo's, plus the ones each test adds after them. */
  function nextVersion(...sql: string[]): string {
    extra.push(...sql);
    const folder = mkdtempSync(join(tmpdir(), "us-ops-50-migrations-"));
    cpSync(MIGRATIONS_FOLDER, folder, { recursive: true });
    const j = JSON.parse(readFileSync(join(folder, "meta", "_journal.json"), "utf8")) as { entries: object[] };
    extra.forEach((statement, i) => {
      const tag = `9${String(i).padStart(3, "0")}_us_ops_50`;
      writeFileSync(join(folder, `${tag}.sql`), statement);
      j.entries.push({ idx: journal.entries.length + i, version: "7", when: lastWhen + 1 + i, tag, breakpoints: true });
    });
    writeFileSync(join(folder, "meta", "_journal.json"), JSON.stringify(j));
    return folder;
  }

  beforeAll(async () => {
    await admin.unsafe(`create database ${name}`);
    await migrateOnStart(url.toString());
    const db = postgres(url.toString(), { max: 1, onnotice: () => {} });
    await db`insert into organization (id, name, slug, created_at) values ('org_us_ops_50', 'Harbour Road Builders', ${`harbour-${name}`}, now())`;
    await db.end();
  }, 120_000);

  afterAll(async () => {
    await admin.unsafe(`drop database if exists ${name} with (force)`);
    await admin.end();
  });

  it("with data and a migration to apply, takes a pg_dump snapshot first, then applies it", async () => {
    const folder = nextVersion("create table us_ops_50_a (id int);");
    const result = await migrateOnStart(url.toString(), { folder, snapshotDir: snapshots, requireSnapshot: true, pgDump });
    expect(result.applied).toBe(1);
    expect(result.snapshot).toMatch(/spine-snapshot-\d{8}-\d{6}-before-1-migration\.dump$/);
    expect(readFileSync(result.snapshot!).subarray(0, 5).toString()).toBe("PGDMP");
  }, 120_000);

  it("with nothing to apply, takes no snapshot", async () => {
    const before = readdirSync(snapshots).length;
    await expect(migrateOnStart(url.toString(), { folder: nextVersion(), snapshotDir: snapshots, requireSnapshot: true, pgDump })).resolves.toMatchObject({ applied: 0 });
    expect(readdirSync(snapshots)).toHaveLength(before);
  });

  it(`keeps the last ${SNAPSHOTS_KEPT} snapshots`, async () => {
    for (let i = 0; i < SNAPSHOTS_KEPT + 1; i++) {
      const folder = nextVersion(`create table us_ops_50_b${i} (id int);`);
      await migrateOnStart(url.toString(), { folder, snapshotDir: snapshots, requireSnapshot: true, pgDump, now: new Date(Date.UTC(2026, 9, 24, 2, 0, i)) });
    }
    expect(readdirSync(snapshots).filter((f) => f.endsWith(".dump"))).toHaveLength(SNAPSHOTS_KEPT);
  }, 240_000);

  it("in production, no snapshot means no migration; a failed migration changes nothing and names the snapshot", async () => {
    const pending = nextVersion("create table us_ops_50_c (id int);");
    await expect(migrateOnStart(url.toString(), { folder: pending, snapshotDir: snapshots, requireSnapshot: true, pgDump: "/nonexistent/pg_dump" })).rejects.toThrow(/Couldn't take the snapshot before migrating, so nothing was changed/);

    const broken = nextVersion("select * from a_table_that_does_not_exist;");
    const failed = await migrateOnStart(url.toString(), { folder: broken, snapshotDir: snapshots, requireSnapshot: true, pgDump }).catch((e: unknown) => e);
    expect(failed).toBeInstanceOf(MigrationError);
    expect((failed as MigrationError).message).toMatch(/none were applied and the database is as it was/);
    expect((failed as MigrationError).snapshot).toMatch(/before-2-migrations\.dump$/);
    // The good migration before the broken one rolled back with it.
    const db = postgres(url.toString(), { max: 1, onnotice: () => {} });
    const [row] = await db<{ n: number }[]>`select count(*)::int as n from information_schema.tables where table_name = 'us_ops_50_c'`;
    await db.end();
    expect(row?.n).toBe(0);
  }, 240_000);
});
