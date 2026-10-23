import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { files, member, session as sessionTable, settings } from "../../db/schema";
import { LocalStorageDriver } from "../../modules/files/storage/local-storage.driver";
import { fileKey } from "../../modules/files/storage/storage-driver";
import { pgTool } from "../../test-utils/pg-tools";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { decryptFile } from "./archive-crypto";
import { type BackupManifest, createBackup } from "./backup";
import { LAST_BACKUP_KEY, recordBackup } from "./backup-status";

type Who = { cookie: string; userId: string };

/** US-OPS-03 (D-105) — one archive with the database, the stored files and a manifest. Requires local Postgres and pg_dump 16. */
describe("US-OPS-03 · back up everything into one file (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const dir = mkdtempSync(join(tmpdir(), "us-ops-03-"));
  const storage = new LocalStorageDriver(join(dir, "files"));
  const stored = { id: randomUUID(), bytes: Buffer.from("%PDF-1.7 receipt for Harbour Road") };
  const gone = { id: randomUUID() };
  /** A row whose key the local driver won't use (an old S3 key with the file's name in it). */
  const oddKey = { id: randomUUID(), key: "" };
  const databaseUrl = process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine";
  const get = (who: Who, path: string) => fetch(`${testApp.baseUrl}${path}`, { headers: { cookie: who.cookie } });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(databaseUrl);
    Object.assign(owner, await signUp(testApp.baseUrl, { email: `us-ops-03-${randomUUID()}@example.com`, password: "testpassword123", name: "Priya Raman" }));
    Object.assign(staff, await signUp(testApp.baseUrl, { email: `us-ops-03-${randomUUID()}@example.com`, password: "testpassword123", name: "Kavya Iyer" }));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, staff.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    await storage.save(fileKey(orgId, stored.id), stored.bytes, "application/pdf");
    oddKey.key = `${orgId}/${oddKey.id}/site photo (1).jpg`;
    await db.insert(files).values([
      { id: oddKey.id, orgId, key: oddKey.key, storageDriver: "local", originalFilename: "site photo (1).jpg", mimeType: "image/jpeg", sizeBytes: 10 },
      { id: stored.id, orgId, key: fileKey(orgId, stored.id), storageDriver: "local", originalFilename: "receipt.pdf", mimeType: "application/pdf", sizeBytes: stored.bytes.length },
      { id: gone.id, orgId, key: fileKey(orgId, gone.id), storageDriver: "local", originalFilename: "lost.pdf", mimeType: "application/pdf", sizeBytes: 10 },
    ]);
  }, 60_000);

  afterAll(async () => {
    await db.delete(files).where(inArray(files.id, [stored.id, gone.id, oddKey.id]));
    await testApp?.close();
  });

  it("writes one .tar.gz with a pg_dump of the database, the stored files and a manifest with the version and checksums", async () => {
    const output = join(dir, "spine-backup-20261023-020000.tar.gz");
    const result = await createBackup({ db, databaseUrl, readers: { local: storage }, output, pgDump: pgTool("pg_dump") });
    expect(result).toMatchObject({ path: output, bytes: statSync(output).size });
    const out = mkdtempSync(join(tmpdir(), "us-ops-03-x-"));
    execFileSync("tar", ["-xzf", output, "-C", out]);
    const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")) as BackupManifest;
    expect(manifest.spineVersion).toBe(JSON.parse(readFileSync(join(process.cwd(), "../../package.json"), "utf8")).version);
    expect(manifest.database.sha256).toBe(createHash("sha256").update(readFileSync(join(out, "database.dump"))).digest("hex"));
    expect(readFileSync(join(out, "database.dump")).subarray(0, 5).toString()).toBe("PGDMP");
    const entry = manifest.files.entries.find((e) => e.id === stored.id)!;
    expect(entry).toMatchObject({ driver: "local", bytes: stored.bytes.length, sha256: createHash("sha256").update(stored.bytes).digest("hex") });
    // Stored in the archive by id, never by key.
    expect(readFileSync(join(out, "files", entry.id)).equals(stored.bytes)).toBe(true);
    // A file whose bytes are gone doesn't stop the backup; it's listed.
    expect(manifest.files.missing).toContainEqual({ id: gone.id, key: fileKey(orgId, gone.id) });
    // So is one whose key its driver can't hold.
    expect(manifest.files.missing).toContainEqual({ id: oddKey.id, key: oddKey.key });
  }, 120_000);

  it("with a passphrase, the archive is encrypted and opens only with it", async () => {
    const output = join(dir, "spine-backup-20261023-030000.tar.gz.enc");
    await createBackup({ db, databaseUrl, readers: { local: storage }, output, passphrase: "a long passphrase", pgDump: pgTool("pg_dump") });
    expect(readFileSync(output).subarray(0, 8).toString()).toBe("SPINEBK1");
    const plain = join(dir, "decrypted.tar.gz");
    await decryptFile(output, plain, "a long passphrase");
    expect(execFileSync("tar", ["-tzf", plain], { encoding: "utf8" })).toContain("manifest.json");
  }, 120_000);

  it("on a failure, nothing is left behind", async () => {
    const output = join(dir, "spine-backup-20261023-040000.tar.gz");
    await expect(createBackup({ db, databaseUrl: "postgres://nobody:wrong@localhost:1/none", readers: { local: storage }, output, pgDump: pgTool("pg_dump") })).rejects.toThrow(/pg_dump|failed/);
    expect(() => statSync(output)).toThrow();
  }, 60_000);

  it("Owners are told when the last backup is more than 2 days old; Staff can't ask", async () => {
    await recordBackup(db, new Date(Date.now() - 3 * 86_400_000));
    const res = await get(owner, "/org/backup-status");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ daysSince: 3, stale: true, lastBackupAt: expect.any(String) });
    expect((await get(staff, "/org/backup-status")).status).toBe(403);
    await recordBackup(db, new Date());
    expect(await (await get(owner, "/org/backup-status")).json()).toMatchObject({ daysSince: 0, stale: false });
    const [row] = await db.select().from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, LAST_BACKUP_KEY)));
    expect(typeof row?.value).toBe("string");
  });
});
