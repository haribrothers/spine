import { HttpException } from "@nestjs/common";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../db/client";
import { FilesService } from "./files.service";
import { LocalStorageDriver } from "./storage/local-storage.driver";
import { MINIMAL_PDF } from "./test-photos";

/** A FilesService whose upload driver is `driver`; the database is never reached in these tests. */
function serviceWith(driver: LocalStorageDriver | null, env: Record<string, string | undefined> = {}) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  for (const [key, value] of Object.entries(env)) if (value === undefined) delete process.env[key];
  const service = new FilesService({} as Database);
  process.env = saved;
  if (driver) (service as unknown as { drivers: { primary: unknown } }).drivers.primary = driver;
  return service;
}

describe("US-OPS-31", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "spine-ops31-"));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("answers 507 with the full-disk message when the volume is full, and leaves no temp file", async () => {
    // The disk fills up part-way through writing the file.
    class FullDisk extends LocalStorageDriver {
      override async save(key: string): Promise<void> {
        const filling = new Readable({
          read() {
            this.push(Buffer.from("%PDF-1.7 first half"));
            this.destroy(Object.assign(new Error("ENOSPC: no space left on device, write"), { code: "ENOSPC" }));
          },
        });
        return super.save(key, filling);
      }
    }
    const service = serviceWith(new FullDisk(root));
    const upload = service.upload("org_a", { originalFilename: "receipt.pdf", mimeType: "application/pdf", buffer: MINIMAL_PDF, uploadedByUserId: null });

    await expect(upload).rejects.toBeInstanceOf(HttpException);
    const error = (await upload.catch((err: HttpException) => err)) as HttpException;
    expect(error.getStatus()).toBe(507);
    expect(error.message).toBe("There's no space left to store this file. Ask an owner to free up space.");
    // Only the (now empty) temp folder exists: no partial file anywhere.
    expect(await readdir(root)).toEqual([".tmp"]);
    expect(await readdir(path.join(root, ".tmp"))).toEqual([]);
  });

  it("reports how full the local files volume is", async () => {
    const status = await serviceWith(null, { FILES_DIR: root, STORAGE_DRIVER: "local" }).storageStatus();
    expect(status.driver).toBe("local");
    expect(status.usedPercent).toBeGreaterThan(0);
    expect(status.usedPercent).toBeLessThanOrEqual(100);
  });

  it("measures at most every 15 minutes", async () => {
    const service = serviceWith(null, { FILES_DIR: root, STORAGE_DRIVER: "local" });
    const first = await service.storageStatus(1_000_000);
    const cached = await service.storageStatus(1_000_000 + 14 * 60 * 1000);
    expect(cached).toBe(first);
    const fresh = await service.storageStatus(1_000_000 + 16 * 60 * 1000);
    expect(fresh).not.toBe(first);
  });

  it("can't tell how full an S3 store is", async () => {
    const status = await serviceWith(null, { STORAGE_DRIVER: "s3", S3_ENDPOINT: "http://localhost:9000" }).storageStatus();
    expect(status).toEqual({ driver: "s3", usedPercent: null });
  });
});
