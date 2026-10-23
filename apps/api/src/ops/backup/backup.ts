import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { asc, gt } from "drizzle-orm";
import type { Database } from "../../db/client";
import { files } from "../../db/schema";
import { spineVersion } from "../../common/version";
import { type StorageDriver, type StorageDriverName, StoredObjectMissingError, UnsafeStorageKeyError } from "../../modules/files/storage/storage-driver";
import { encryptFile } from "./archive-crypto";

export const BACKUP_FORMAT = 1;

/** A fingerprint of AUTH_SECRET that says whether two installs share it, without revealing it. */
export function authSecretFingerprint(secret: string | undefined = process.env.AUTH_SECRET): string | null {
  return secret ? createHash("sha256").update(`spine-backup-fingerprint:${secret}`).digest("hex").slice(0, 16) : null;
}

/** What a backup's `manifest.json` records (US-OPS-03). */
export interface BackupManifest {
  format: number;
  spineVersion: string;
  createdAt: string;
  /** Which AUTH_SECRET the install had (a fingerprint, not the secret): two-factor and stored keys need the same one after a restore (US-OPS-04). */
  authSecretFingerprint: string | null;
  database: { file: string; bytes: number; sha256: string };
  /** Each file is at `files/<id>` in the archive (never its key, which comes from the database); `key` is where it goes back. */
  files: { count: number; bytes: number; entries: { id: string; key: string; driver: StorageDriverName; bytes: number; sha256: string }[]; missing: { id: string; key: string }[] };
}

export interface BackupOptions {
  db: Database;
  databaseUrl: string;
  /** Every driver files may be stored with, by name (createStorageDrivers().readers). */
  readers: Partial<Record<StorageDriverName, StorageDriver>>;
  /** Where the archive goes: `spine-backup-<YYYYMMDD-HHMMSS>.tar.gz`, or `.tar.gz.enc` when encrypted. */
  output: string;
  passphrase?: string;
  /** The pg_dump to run (PG_DUMP); `pg_dump` from the PATH by default. */
  pgDump?: string;
  log?: (line: string) => void;
  now?: Date;
}

export interface BackupResult {
  path: string;
  bytes: number;
  manifest: BackupManifest;
}

const PAGE = 200;

function run(command: string, args: string[], stdoutTo?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", stdoutTo ? "pipe" : "inherit", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    const out = stdoutTo ? createWriteStream(stdoutTo) : null;
    if (out && child.stdout) child.stdout.pipe(out);
    child.on("error", (err) => reject(new Error(`Couldn't run ${command}: ${err.message}`)));
    child.on("close", (code) => {
      const done = () => (code === 0 ? resolve() : reject(new Error(`${command} failed (exit ${code}): ${stderr.trim().split("\n").slice(-3).join(" ")}`)));
      if (out) out.close(done);
      else done();
    });
  });
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

/** A dump that pg_restore can load into a clean database: no owners or grants from this server. */
export function pgDumpArgs(databaseUrl: string): string[] {
  return ["--format=custom", "--no-owner", "--no-privileges", "--dbname", databaseUrl];
}

/**
 * US-OPS-03 (D-105) — one archive with everything needed to restore Spine:
 * `database.dump` (pg_dump, custom format), every stored file read through
 * its own storage driver (the local volume or the S3 bucket, never the
 * folder directly) under `files/<key>`, and `manifest.json` with the version
 * and each file's checksum. A file whose bytes are gone is listed as missing
 * rather than failing the backup. Encrypted when a passphrase is given.
 * On any failure nothing is left at `output`.
 */
export async function createBackup(options: BackupOptions): Promise<BackupResult> {
  const log = options.log ?? (() => {});
  const work = await mkdtemp(join(tmpdir(), "spine-backup-"));
  const tarball = options.passphrase ? join(work, "archive.tar.gz") : options.output;
  try {
    const content = join(work, "content");
    await mkdir(join(content, "files"), { recursive: true });

    log("Dumping the database…");
    const dump = join(content, "database.dump");
    await run(options.pgDump ?? "pg_dump", pgDumpArgs(options.databaseUrl), dump);
    const database = { file: "database.dump", bytes: (await stat(dump)).size, sha256: await sha256File(dump) };

    log("Copying the stored files…");
    const entries: BackupManifest["files"]["entries"] = [];
    const missing: BackupManifest["files"]["missing"] = [];
    let after: string | undefined;
    for (;;) {
      const page = await options.db
        .select({ id: files.id, key: files.key, driver: files.storageDriver })
        .from(files)
        .where(after ? gt(files.id, after) : undefined)
        .orderBy(asc(files.id))
        .limit(PAGE);
      if (!page.length) break;
      for (const row of page) {
        const driver = options.readers[row.driver as StorageDriverName];
        const target = join(content, "files", row.id);
        try {
          if (!driver) throw new StoredObjectMissingError(row.key);
          await pipeline(await driver.openReadStream(row.key), createWriteStream(target));
          entries.push({ id: row.id, key: row.key, driver: row.driver as StorageDriverName, bytes: (await stat(target)).size, sha256: await sha256File(target) });
        } catch (err) {
          // Gone, or a key its driver can't hold: listed as missing. Anything else (a disk or network error) fails the backup.
          if (!(err instanceof StoredObjectMissingError || err instanceof UnsafeStorageKeyError)) throw err;
          await rm(target, { force: true });
          missing.push({ id: row.id, key: row.key });
        }
      }
      after = page[page.length - 1]!.id;
    }
    if (missing.length) log(`${missing.length} stored file${missing.length === 1 ? " is" : "s are"} missing and couldn't be included (listed in the manifest).`);

    const manifest: BackupManifest = {
      format: BACKUP_FORMAT,
      spineVersion: spineVersion(),
      createdAt: (options.now ?? new Date()).toISOString(),
      authSecretFingerprint: authSecretFingerprint(),
      database,
      files: { count: entries.length, bytes: entries.reduce((n, e) => n + e.bytes, 0), entries, missing },
    };
    await writeFile(join(content, "manifest.json"), JSON.stringify(manifest, null, 2));

    log("Writing the archive…");
    await run("tar", ["-czf", tarball, "-C", content, "manifest.json", "database.dump", "files"]);
    if (options.passphrase) {
      log("Encrypting it…");
      await encryptFile(tarball, options.output, options.passphrase);
    }
    return { path: options.output, bytes: (await stat(options.output)).size, manifest };
  } catch (err) {
    await rm(options.output, { force: true });
    throw err;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
