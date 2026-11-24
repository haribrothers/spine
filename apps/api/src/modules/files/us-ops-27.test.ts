import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseRange } from "./files.controller";
import { MAX_FILE_LINK_SECONDS, signFileLink, verifyFileLink } from "./file-link";
import { LocalStorageDriver } from "./storage/local-storage.driver";
import { createStorageDrivers, resolveFilesDir } from "./storage/storage-config";
import { fileKey } from "./storage/storage-driver";
import { storageDriverScenarios } from "./storage/storage-driver.scenarios";

describe("US-OPS-27", () => {
  let root: string;
  let driver: LocalStorageDriver;

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "spine-files-"));
    driver = new LocalStorageDriver(root);
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe("local driver", () => {
    storageDriverScenarios(() => driver);

    it("stores files at <root>/<org-id>/<2-char prefix>/<file-id>", async () => {
      const fileId = randomUUID();
      await driver.save(fileKey("org_abc", fileId), Buffer.from("x"), "text/plain");
      const info = await stat(path.join(root, "org_abc", fileId.slice(0, 2), fileId));
      expect(info.isFile()).toBe(true);
    });

    it("leaves no temp file behind after a failed upload", async () => {
      const failing = new Readable({
        read() {
          this.destroy(new Error("disk unplugged"));
        },
      });
      await expect(driver.save(fileKey("org_abc", randomUUID()), failing, "image/png")).rejects.toThrow();
      expect((await readdir(path.join(root, ".tmp"))).filter((n) => n.endsWith(".part"))).toEqual([]);
    });

    it("after a crash mid-write, the restarted API never serves the partial file and cleans it up", async () => {
      const crashRoot = await mkdtemp(path.join(tmpdir(), "spine-crash-"));
      try {
        // What a process killed mid-write leaves: a .part file, never the final path.
        const fileId = randomUUID();
        const partial = path.join(crashRoot, ".tmp", `${randomUUID()}.part`);
        await new LocalStorageDriver(crashRoot).save(fileKey("org_a", randomUUID()), Buffer.from("ok"), "text/plain");
        await writeFile(partial, "half a recei");
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        await utimes(partial, twoHoursAgo, twoHoursAgo);

        const restarted = new LocalStorageDriver(crashRoot);
        expect(await restarted.exists(fileKey("org_a", fileId))).toBe(false);
        await restarted.save(fileKey("org_a", randomUUID()), Buffer.from("next upload"), "text/plain");
        expect(await readdir(path.join(crashRoot, ".tmp"))).toEqual([]);
      } finally {
        await rm(crashRoot, { recursive: true, force: true });
      }
    });

    it.each(["../../etc/passwd", "org/../../x", "/etc/passwd", "org/file.pdf", "org//id", ""])(
      "refuses the unsafe key %j",
      async (key) => {
        await expect(driver.save(key, Buffer.from("x"), "text/plain")).rejects.toThrow(/unsafe storage key/);
        await expect(driver.exists(key)).rejects.toThrow(/unsafe storage key/);
      },
    );
  });

  describe("driver selection", () => {
    it("uses the local driver when nothing is configured", () => {
      const drivers = createStorageDrivers({ FILES_DIR: root });
      expect(drivers.primary?.name).toBe("local");
      expect(drivers.readers.s3).toBeUndefined();
    });

    it("uses the s3 driver when STORAGE_DRIVER=s3 and S3_ENDPOINT are set", () => {
      const drivers = createStorageDrivers({
        STORAGE_DRIVER: "s3",
        S3_ENDPOINT: "http://localhost:9000",
        S3_BUCKET: "spine",
        S3_ACCESS_KEY: "key",
        S3_SECRET_KEY: "secret",
      });
      expect(drivers.primary?.name).toBe("s3");
      expect(drivers.readers.local?.name).toBe("local");
    });

    it("keeps S3 files readable after switching back to local", () => {
      const drivers = createStorageDrivers({ S3_ENDPOINT: "http://localhost:9000", FILES_DIR: root });
      expect(drivers.primary?.name).toBe("local");
      expect(drivers.readers.s3?.name).toBe("s3");
    });

    it("has no upload driver when STORAGE_DRIVER=s3 but S3 isn't configured", () => {
      expect(createStorageDrivers({ STORAGE_DRIVER: "s3" }).primary).toBeNull();
    });

    it("stores files on the /data/files volume in production", () => {
      expect(resolveFilesDir({ NODE_ENV: "production" })).toBe("/data/files");
      expect(resolveFilesDir({ NODE_ENV: "production", FILES_DIR: "/srv/spine" })).toBe("/srv/spine");
    });
  });

  describe("signed file links", () => {
    const secret = "test-secret";
    const fileId = randomUUID();
    const now = Date.UTC(2026, 9, 4, 12, 0, 0);

    it("accepts a fresh link for the same file", () => {
      const { exp, sig } = signFileLink(fileId, secret, 60, now);
      expect(verifyFileLink(fileId, String(exp), sig, secret, now)).toBe(true);
    });

    it("never signs a link for longer than 5 minutes", () => {
      const { exp } = signFileLink(fileId, secret, 3600, now);
      expect(exp - now / 1000).toBe(MAX_FILE_LINK_SECONDS);
    });

    it("rejects an expired link", () => {
      const { exp, sig } = signFileLink(fileId, secret, 60, now);
      expect(verifyFileLink(fileId, exp, sig, secret, now + 61_000)).toBe(false);
    });

    it("rejects a link for another file, a changed expiry, a wrong secret or a missing signature", () => {
      const { exp, sig } = signFileLink(fileId, secret, 60, now);
      expect(verifyFileLink(randomUUID(), exp, sig, secret, now)).toBe(false);
      expect(verifyFileLink(fileId, exp + 1, sig, secret, now)).toBe(false);
      expect(verifyFileLink(fileId, exp, sig, "other-secret", now)).toBe(false);
      expect(verifyFileLink(fileId, exp, undefined, secret, now)).toBe(false);
    });

    it("rejects a hand-made link that claims to last more than 5 minutes", () => {
      const { sig } = signFileLink(fileId, secret, 60, now);
      const farFuture = Math.floor(now / 1000) + MAX_FILE_LINK_SECONDS + 60;
      expect(verifyFileLink(fileId, farFuture, sig, secret, now)).toBe(false);
    });
  });

  describe("range requests", () => {
    it.each([
      [undefined, null],
      ["bytes=0-3", { start: 0, end: 3 }],
      ["bytes=4-", { start: 4, end: 9 }],
      ["bytes=-3", { start: 7, end: 9 }],
      ["bytes=5-100", { start: 5, end: 9 }],
      ["bytes=10-", "unsatisfiable"],
      ["bytes=5-2", "unsatisfiable"],
      ["bytes=0-1,4-5", null],
      ["items=0-3", null],
    ])("parses %j for a 10-byte file", (header, expected) => {
      expect(parseRange(header, 10)).toEqual(expected);
    });
  });
});
