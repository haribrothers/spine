import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../../db/client";
import { migrateOnStart } from "../../db/migrate-on-start";
import { LocalStorageDriver } from "../../modules/files/storage/local-storage.driver";
import { fileKey } from "../../modules/files/storage/storage-driver";
import { pgTool } from "../../test-utils/pg-tools";
import { createBackup } from "./backup";
import { RestoreRefusedError, compareVersions, restoreBackup } from "./restore";

/** US-OPS-04 — restore a backup into a clean install. Requires local Postgres (CREATE DATABASE), pg_dump and pg_restore 16. */
describe("US-OPS-04 · restore a backup into a clean install (requires local Postgres)", () => {
  const base = new URL(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  const suffix = randomUUID().replace(/-/g, "").slice(0, 10);
  const urlFor = (name: string) => {
    const u = new URL(base);
    u.pathname = `/${name}`;
    return u.toString();
  };
  const source = { name: `us_ops_04_src_${suffix}`, url: "" };
  const target = { name: `us_ops_04_dst_${suffix}`, url: "" };
  source.url = urlFor(source.name);
  target.url = urlFor(target.name);
  const admin = postgres(base.toString(), { max: 1, onnotice: () => {} });
  const dir = mkdtempSync(join(tmpdir(), "us-ops-04-"));
  const sourceFiles = new LocalStorageDriver(join(dir, "source-files"));
  const targetFiles = new LocalStorageDriver(join(dir, "target-files"));
  const orgId = `org_${suffix}`;
  const fileIds = [randomUUID(), randomUUID()];
  const bytes = [Buffer.from("logo bytes"), Buffer.from("%PDF receipt")];
  let archive = "";
  let encrypted = "";

  /** Every table's row count — the same before the backup and after the restore. */
  async function rowCounts(url: string): Promise<Record<string, number>> {
    const sql = postgres(url, { max: 1, onnotice: () => {} });
    try {
      const tables = await sql<{ t: string }[]>`select table_name as t from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`;
      const counts: Record<string, number> = {};
      for (const { t } of tables) counts[t] = (await sql.unsafe<{ n: number }[]>(`select count(*)::int as n from "${t}"`))[0]!.n;
      return counts;
    } finally {
      await sql.end();
    }
  }

  beforeAll(async () => {
    for (const db of [source, target]) await admin.unsafe(`create database ${db.name}`);
    await migrateOnStart(source.url);
    await migrateOnStart(target.url); // a clean install: tables, no data
    const sql = postgres(source.url, { max: 1, onnotice: () => {} });
    await sql`insert into organization (id, name, slug, created_at) values (${orgId}, 'Harbour Road Builders', ${`harbour-${suffix}`}, now())`;
    for (const [i, id] of fileIds.entries()) {
      await sourceFiles.save(fileKey(orgId, id), bytes[i]!, "application/octet-stream");
      await sql`insert into files (id, org_id, key, storage_driver, original_filename, mime_type, size_bytes) values (${id}, ${orgId}, ${fileKey(orgId, id)}, 'local', ${`f${i}`}, 'application/octet-stream', ${bytes[i]!.length})`;
    }
    await sql.end();
    archive = join(dir, "spine-backup-20261023-020000.tar.gz");
    encrypted = join(dir, "spine-backup-20261023-030000.tar.gz.enc");
    const db = createDb(source.url);
    await createBackup({ db, databaseUrl: source.url, readers: { local: sourceFiles }, output: archive, pgDump: pgTool("pg_dump") });
    await createBackup({ db, databaseUrl: source.url, readers: { local: sourceFiles }, output: encrypted, passphrase: "kitchen table", pgDump: pgTool("pg_dump") });
  }, 180_000);

  afterAll(async () => {
    for (const db of [source, target]) await admin.unsafe(`drop database if exists ${db.name} with (force)`);
    await admin.end();
  });

  const restore = (extra: Partial<Parameters<typeof restoreBackup>[0]> = {}) =>
    restoreBackup({ archive, databaseUrl: target.url, readers: { local: targetFiles }, primary: targetFiles, primaryName: "local", pgRestore: pgTool("pg_restore"), ...extra });

  it("orders versions as semver does", () => {
    expect(["1.0.0", "1.0.0-beta.2", "1.0.1", "1.0.0-rc.1", "1.0.0-beta.10", "0.9.9"].sort(compareVersions)).toEqual(["0.9.9", "1.0.0-beta.2", "1.0.0-beta.10", "1.0.0-rc.1", "1.0.0", "1.0.1"]);
  });

  it("an encrypted backup needs its passphrase; a wrong one changes nothing", async () => {
    await expect(restore({ archive: encrypted })).rejects.toBeInstanceOf(RestoreRefusedError);
    await expect(restore({ archive: encrypted, passphrase: "wrong" })).rejects.toThrow(/passphrase doesn't open this backup/);
    expect((await rowCounts(target.url)).organization).toBe(0);
  });

  it("a backup from a newer Spine is refused, with a message to upgrade first", async () => {
    const work = mkdtempSync(join(tmpdir(), "us-ops-04-newer-"));
    execFileSync("tar", ["-xzf", archive, "-C", work]);
    const manifest = JSON.parse(readFileSync(join(work, "manifest.json"), "utf8")) as { spineVersion: string };
    manifest.spineVersion = "99.0.0";
    writeFileSync(join(work, "manifest.json"), JSON.stringify(manifest));
    const newer = join(dir, "newer.tar.gz");
    execFileSync("tar", ["-czf", newer, "-C", work, "manifest.json", "database.dump", "files"]);
    await expect(restore({ archive: newer })).rejects.toThrow(/This backup is from Spine 99\.0\.0, which is newer than this install .*Upgrade this install to 99\.0\.0 or later first/);
  });

  it("a different AUTH_SECRET is refused unless --new-secret", async () => {
    const saved = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "a-completely-different-secret-for-this-install";
    try {
      await expect(restore()).rejects.toThrow(/AUTH_SECRET isn't the one the backup was made with/);
    } finally {
      process.env.AUTH_SECRET = saved;
    }
  });

  it("into a clean install: the database and every file come back as they were", async () => {
    const result = await restore({ archive: encrypted, passphrase: "kitchen table" });
    expect(result.files).toBe(2);
    expect(await rowCounts(target.url)).toEqual(await rowCounts(source.url));
    for (const [i, id] of fileIds.entries()) {
      const chunks: Buffer[] = [];
      for await (const chunk of await targetFiles.openReadStream(fileKey(orgId, id))) chunks.push(chunk as Buffer);
      expect(Buffer.concat(chunks).equals(bytes[i]!)).toBe(true);
    }
    // The API's start-up migration finds nothing to do on a backup from this version.
    await expect(migrateOnStart(target.url)).resolves.toMatchObject({ applied: 0 });
  }, 120_000);

  it("an install that already has data is left alone unless --replace", async () => {
    await expect(restore()).rejects.toThrow(/already has data \(1 organisation\)/);
    await expect(restore({ replace: true })).resolves.toMatchObject({ files: 2 });
    expect((await rowCounts(target.url)).organization).toBe(1);
  }, 120_000);
});
