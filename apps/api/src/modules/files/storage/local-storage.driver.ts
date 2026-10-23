import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { link, mkdir, open, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { type ByteRange, type StorageDriver, StoredObjectExistsError, StoredObjectMissingError, UnsafeStorageKeyError } from "./storage-driver";

/** Keys are ids joined by `/` (see `fileKey`); anything else is refused before it reaches the disk. */
const SAFE_KEY = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/;

/** Temp files older than this are leftovers from a crash and are removed on start. */
const STALE_TEMP_MS = 60 * 60 * 1000;

/**
 * The default driver (D-102): files on the API container's `spine_files`
 * volume, mounted at `/data/files`.
 *
 * Crash safety (NFR-REL-08): bytes are written to `<root>/.tmp/<uuid>.part`,
 * fsynced, then hard-linked into place and the temp name removed. A link
 * within one filesystem is atomic, so a reader sees either no file or the
 * whole file — never a partial one — and unlike a rename it fails if the
 * key already exists, which makes files write-once (US-OPS-28). A crash
 * mid-write only leaves a `.part` file, which nothing ever serves and
 * which the next start removes.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;
  private readonly tmpDir: string;
  private ready: Promise<void> | null = null;

  constructor(readonly root: string) {
    this.tmpDir = path.join(root, ".tmp");
  }

  async save(key: string, data: Buffer | Readable, _contentType?: string): Promise<void> {
    const target = this.pathFor(key);
    await this.init();
    const tmp = path.join(this.tmpDir, `${randomUUID()}.part`);
    try {
      const source = Buffer.isBuffer(data) ? Readable.from([data]) : data;
      await pipeline(source, createWriteStream(tmp, { flags: "wx", mode: 0o600 }));
      await fsyncPath(tmp, "r+");
      await mkdir(path.dirname(target), { recursive: true });
      try {
        await link(tmp, target);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EEXIST") throw new StoredObjectExistsError(key);
        throw err;
      }
      // Makes the new name itself survive a power cut.
      await fsyncPath(path.dirname(target), "r").catch(() => undefined);
    } finally {
      await rm(tmp, { force: true });
    }
  }

  async openReadStream(key: string, range?: ByteRange): Promise<Readable> {
    const file = this.pathFor(key);
    if (!(await this.exists(key))) throw new StoredObjectMissingError(key);
    return createReadStream(file, range ? { start: range.start, end: range.end } : undefined);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      return (await stat(this.pathFor(key))).isFile();
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw err;
    }
  }

  /** Creates the folders and removes temp files a crash left behind. Retried on the next call if it fails. */
  private init(): Promise<void> {
    this.ready ??= (async () => {
      await mkdir(this.tmpDir, { recursive: true });
      const cutoff = Date.now() - STALE_TEMP_MS;
      for (const name of await readdir(this.tmpDir)) {
        const file = path.join(this.tmpDir, name);
        const info = await stat(file).catch(() => null);
        if (info && info.mtimeMs < cutoff) await rm(file, { force: true });
      }
    })().catch((err: unknown) => {
      this.ready = null;
      throw err;
    });
    return this.ready;
  }

  private pathFor(key: string): string {
    if (!SAFE_KEY.test(key)) throw new UnsafeStorageKeyError(key);
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(path.resolve(this.root) + path.sep)) {
      throw new Error(`Refusing storage key outside the files folder: ${key}`);
    }
    return resolved;
  }
}

async function fsyncPath(target: string, flags: "r" | "r+"): Promise<void> {
  const handle = await open(target, flags);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
