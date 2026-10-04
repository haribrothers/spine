import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FileIntegrityWorker, filesDamagedMessage } from "./file-integrity.worker";
import { sha256 } from "./files.service";
import { LocalStorageDriver } from "./storage/local-storage.driver";
import { StoredObjectExistsError, fileKey } from "./storage/storage-driver";

describe("US-OPS-28", () => {
  let root: string;
  let driver: LocalStorageDriver;

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "spine-ops28-"));
    driver = new LocalStorageDriver(root);
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("refuses to replace a stored file (issued files are write-once)", async () => {
    const key = fileKey("org_a", randomUUID());
    await driver.save(key, Buffer.from("issued invoice PDF"), "application/pdf");
    await expect(driver.save(key, Buffer.from("tampered PDF"), "application/pdf")).rejects.toBeInstanceOf(
      StoredObjectExistsError,
    );
    expect((await readFile(path.join(root, key))).toString()).toBe("issued invoice PDF");
  });

  it("computes the SHA-256 of a file's bytes as lowercase hex", () => {
    expect(sha256(Buffer.from("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("words the owners' warning exactly", () => {
    expect(filesDamagedMessage(3)).toBe("3 stored files are damaged or missing — restore from your latest backup.");
    expect(filesDamagedMessage(1)).toBe("1 stored file is damaged or missing — restore from your latest backup.");
  });

  it("never stops the API from starting when the start-up backfill check fails", async () => {
    const queue = { schedule: vi.fn(), work: vi.fn(), send: vi.fn() };
    const files = { hasFilesWithoutChecksum: vi.fn().mockRejectedValue(new Error('column "checksum_sha256" does not exist')) };
    const worker = new FileIntegrityWorker(queue as never, files as never, {} as never);
    await expect(worker.onModuleInit()).resolves.toBeUndefined();
    expect(queue.send).not.toHaveBeenCalled();
  });
});
