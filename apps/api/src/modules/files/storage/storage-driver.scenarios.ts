import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { expect, it } from "vitest";
import { type StorageDriver, StoredObjectMissingError, fileKey } from "./storage-driver";

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

/**
 * The storage behaviour every driver must share (US-OPS-27): run against
 * `local` on a temp folder and against `s3` on S3Mock in CI.
 */
export function storageDriverScenarios(getDriver: () => StorageDriver): void {
  const newKey = () => fileKey(`org_${randomUUID().slice(0, 8)}`, randomUUID());

  it("saves a file and reads the same bytes back", async () => {
    const driver = getDriver();
    const key = newKey();
    const bytes = Buffer.from("receipt bytes ✓");
    await driver.save(key, bytes, "application/pdf");
    expect(await driver.exists(key)).toBe(true);
    expect(await readAll(await driver.openReadStream(key))).toEqual(bytes);
  });

  it("saves a stream", async () => {
    const driver = getDriver();
    const key = newKey();
    await driver.save(key, Readable.from([Buffer.from("part one, "), Buffer.from("part two")]), "text/plain");
    expect((await readAll(await driver.openReadStream(key))).toString()).toBe("part one, part two");
  });

  it("reads a byte range", async () => {
    const driver = getDriver();
    const key = newKey();
    await driver.save(key, Buffer.from("0123456789"), "text/plain");
    expect((await readAll(await driver.openReadStream(key, { start: 2, end: 5 }))).toString()).toBe("2345");
  });

  it("reports a missing file as missing", async () => {
    const driver = getDriver();
    const key = newKey();
    expect(await driver.exists(key)).toBe(false);
    await expect(driver.openReadStream(key)).rejects.toBeInstanceOf(StoredObjectMissingError);
  });

  it("deletes a file, and deleting it again is not an error", async () => {
    const driver = getDriver();
    const key = newKey();
    await driver.save(key, Buffer.from("photo"), "image/png");
    await driver.delete(key);
    expect(await driver.exists(key)).toBe(false);
    await expect(driver.delete(key)).resolves.toBeUndefined();
  });

  it("never leaves a readable file when an upload fails part-way", async () => {
    const driver = getDriver();
    const key = newKey();
    const failingUpload = new Readable({
      read() {
        this.push(Buffer.from("first half of the photo"));
        this.destroy(new Error("connection dropped"));
      },
    });
    await expect(driver.save(key, failingUpload, "image/jpeg")).rejects.toThrow("connection dropped");
    expect(await driver.exists(key)).toBe(false);
  });
}
