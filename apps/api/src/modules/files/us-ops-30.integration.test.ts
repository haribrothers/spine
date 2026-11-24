import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { files, organization } from "../../db/schema";
import { FilesService, sha256 } from "./files.service";
import { migrateFiles } from "./migrate-files";
import { LocalStorageDriver } from "./storage/local-storage.driver";
import { S3StorageDriver, getS3Config } from "./storage/s3-storage.driver";
import { type StorageDriver, StoredObjectMissingError, fileKey } from "./storage/storage-driver";

/** Stands in for an old MinIO bucket: any key, including the pre-US-OPS-27 `{org}/{id}/{filename}` shape. */
class BucketStandIn implements StorageDriver {
  readonly name = "s3" as const;
  readonly objects = new Map<string, Buffer>();
  async save(key: string, data: Buffer | Readable) {
    this.objects.set(key, Buffer.isBuffer(data) ? data : Buffer.alloc(0));
  }
  async openReadStream(key: string) {
    const bytes = this.objects.get(key);
    if (!bytes) throw new StoredObjectMissingError(key);
    return Readable.from([bytes]);
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
  async exists(key: string) {
    return this.objects.has(key);
  }
}

/**
 * US-OPS-30 — `files:migrate --from s3 --to local`. Requires local
 * Postgres; the target is a temp folder.
 */
describe("US-OPS-30 · move existing files off MinIO (requires local Postgres)", () => {
  let db: Database;
  let filesDir: string;
  let target: LocalStorageDriver;
  let orgId: string;
  const savedFilesDir = process.env.FILES_DIR;

  async function addS3File(bucket: StorageDriver, content: string, name: string, checksum: "set" | "none" | "wrong" = "set") {
    const id = randomUUID();
    const key = `${orgId}/${id}/${name}`;
    const bytes = Buffer.from(`%PDF-1.7\n${content}`);
    await bucket.save(key, bytes, "application/pdf");
    await db.insert(files).values({
      id,
      orgId,
      key,
      storageDriver: "s3",
      originalFilename: name,
      mimeType: "application/pdf",
      sizeBytes: bytes.length,
      checksumSha256: checksum === "set" ? sha256(bytes) : checksum === "wrong" ? sha256(Buffer.from("other")) : null,
    });
    return { id, key, bytes };
  }

  async function row(id: string) {
    const [found] = await db.select().from(files).where(eq(files.id, id));
    return found!;
  }

  beforeAll(async () => {
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    filesDir = await mkdtemp(path.join(tmpdir(), "spine-ops30-"));
    target = new LocalStorageDriver(filesDir);
  });

  afterEach(async () => {
    if (orgId) await db.delete(organization).where(eq(organization.id, orgId));
  });

  afterAll(async () => {
    await rm(filesDir, { recursive: true, force: true });
    if (savedFilesDir === undefined) delete process.env.FILES_DIR;
    else process.env.FILES_DIR = savedFilesDir;
  });

  async function newOrg() {
    orgId = `org_${randomUUID().replace(/-/g, "")}`;
    await db.insert(organization).values({ id: orgId, name: "Migrating Co", slug: orgId, createdAt: new Date() });
  }

  it("copies every file into the files volume, verifies it, and reports the counts", async () => {
    await newOrg();
    const bucket = new BucketStandIn();
    const a = await addS3File(bucket, "invoice 1", "INV-0001.pdf");
    const b = await addS3File(bucket, "receipt", "fuel receipt.pdf", "none");

    const result = await migrateFiles(db, bucket, target, { orgId });

    expect(result).toEqual({ copied: 2, skipped: 0, failed: [] });
    for (const file of [a, b]) {
      const after = await row(file.id);
      expect(after.storageDriver).toBe("local");
      expect(after.key).toBe(fileKey(orgId, file.id));
      expect(after.checksumSha256).toBe(sha256(file.bytes));
      expect((await readFile(path.join(filesDir, after.key))).equals(file.bytes)).toBe(true);
    }
    // The bucket is left exactly as it was.
    expect(bucket.objects.size).toBe(2);
    expect(bucket.objects.get(a.key)?.equals(a.bytes)).toBe(true);
  });

  it("with STORAGE_DRIVER=local after the move, every attachment opens as before", async () => {
    await newOrg();
    const bucket = new BucketStandIn();
    const file = await addS3File(bucket, "signed quote", "QUO-0007.pdf");
    await migrateFiles(db, bucket, target, { orgId });

    process.env.FILES_DIR = filesDir;
    const service = new FilesService(db);
    const { bytes } = await service.readBytes(orgId, file.id);
    expect(bytes.equals(file.bytes)).toBe(true);
  });

  it("is safe to run again: moved files are skipped", async () => {
    await newOrg();
    const bucket = new BucketStandIn();
    await addS3File(bucket, "one", "one.pdf");
    await addS3File(bucket, "two", "two.pdf");
    await migrateFiles(db, bucket, target, { orgId });

    const again = await migrateFiles(db, bucket, target, { orgId });
    expect(again).toEqual({ copied: 0, skipped: 2, failed: [] });
  });

  it("reuses a copy left by an interrupted run when its checksum matches", async () => {
    await newOrg();
    const bucket = new BucketStandIn();
    const file = await addS3File(bucket, "half-finished run", "half.pdf");
    await target.save(fileKey(orgId, file.id), file.bytes, "application/pdf"); // copied, row not yet switched

    const result = await migrateFiles(db, bucket, target, { orgId });
    expect(result).toEqual({ copied: 0, skipped: 1, failed: [] });
    expect((await row(file.id)).storageDriver).toBe("local");
  });

  it("lists failures, leaves their records and the bucket untouched, and still moves the rest", async () => {
    await newOrg();
    const bucket = new BucketStandIn();
    const good = await addS3File(bucket, "fine", "fine.pdf");
    const damaged = await addS3File(bucket, "bit rot", "damaged.pdf", "wrong");
    const gone = await addS3File(bucket, "deleted from minio", "gone.pdf");
    bucket.objects.delete(gone.key);

    const result = await migrateFiles(db, bucket, target, { orgId });

    expect(result.copied).toBe(1);
    expect(result.failed.map((f) => f.fileId).sort()).toEqual([damaged.id, gone.id].sort());
    expect(result.failed.find((f) => f.fileId === gone.id)?.reason).toBe("missing from s3");
    expect(result.failed.find((f) => f.fileId === damaged.id)?.reason).toMatch(/checksum mismatch/);
    expect((await row(good.id)).storageDriver).toBe("local");
    expect(await row(damaged.id)).toMatchObject({ storageDriver: "s3", key: damaged.key });
    expect(bucket.objects.get(damaged.key)?.equals(damaged.bytes)).toBe(true);
  });

  const s3Config = getS3Config();
  it.skipIf(!s3Config)("moves files from a real S3 store (S3Mock in CI)", async () => {
    await newOrg();
    const bucket = new S3StorageDriver(s3Config!);
    const file = await addS3File(bucket, "from a real bucket", "real.pdf");

    const result = await migrateFiles(db, bucket, target, { orgId });

    expect(result).toEqual({ copied: 1, skipped: 0, failed: [] });
    expect((await readFile(path.join(filesDir, fileKey(orgId, file.id)))).equals(file.bytes)).toBe(true);
    expect(await bucket.exists(file.key)).toBe(true);
  });
});
