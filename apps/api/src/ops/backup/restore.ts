import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import postgres from "postgres";
import { spineVersion } from "../../common/version";
import { type StorageDriver, type StorageDriverName, StoredObjectMissingError } from "../../modules/files/storage/storage-driver";
import { decryptFile, isEncrypted } from "./archive-crypto";
import { BACKUP_FORMAT, type BackupManifest, authSecretFingerprint } from "./backup";

/** A restore that stops before changing anything, with what to do instead. */
export class RestoreRefusedError extends Error {}

/** -1, 0 or 1, as semver orders them: 1.0.0-beta.2 < 1.0.0-rc.1 < 1.0.0 < 1.0.1. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [core, pre] = v.split("-", 2) as [string, string | undefined];
    return { nums: core.split(".").map((n) => Number(n) || 0), pre: pre ? pre.split(".") : [] };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) if ((x.nums[i] ?? 0) !== (y.nums[i] ?? 0)) return (x.nums[i] ?? 0) < (y.nums[i] ?? 0) ? -1 : 1;
  if (!x.pre.length || !y.pre.length) return x.pre.length === y.pre.length ? 0 : x.pre.length ? -1 : 1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    if (pn && qn) return Number(p) < Number(q) ? -1 : 1;
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

export interface RestoreOptions {
  archive: string;
  databaseUrl: string;
  readers: Partial<Record<StorageDriverName, StorageDriver>>;
  /** Where a file goes when this install has no driver of the kind it was stored with. */
  primary: StorageDriver | null;
  primaryName: StorageDriverName;
  passphrase?: string;
  /** Overwrite an install that already has data. */
  replace?: boolean;
  /** Restore although this install's AUTH_SECRET isn't the backup's. */
  newSecret?: boolean;
  pgRestore?: string;
  log?: (line: string) => void;
}

export interface RestoreResult {
  manifest: BackupManifest;
  files: number;
}

function run(command: string, args: string[], stdinFrom?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: [stdinFrom ? "pipe" : "ignore", "ignore", "pipe"] });
    if (stdinFrom && child.stdin) createReadStream(stdinFrom).pipe(child.stdin);
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", (err) => reject(new Error(`Couldn't run ${command}: ${err.message}`)));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${command} failed (exit ${code}): ${stderr.trim().split("\n").slice(-3).join(" ")}`))));
  });
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

/**
 * US-OPS-04 — puts a backup (US-OPS-03) back: checks everything first (the
 * passphrase, the version, every checksum, that this install is empty and
 * shares the backup's AUTH_SECRET), and only then replaces the database with
 * the dump and writes each file through a storage driver. A backup from an
 * older Spine is fine: the API brings it up to date when it next starts.
 */
export async function restoreBackup(options: RestoreOptions): Promise<RestoreResult> {
  const log = options.log ?? (() => {});
  const work = await mkdtemp(join(tmpdir(), "spine-restore-"));
  try {
    let tarball = options.archive;
    if (await isEncrypted(options.archive)) {
      if (!options.passphrase) throw new RestoreRefusedError("This backup is encrypted. Run the restore again with its passphrase (--passphrase, or BACKUP_PASSPHRASE).");
      log("Decrypting the backup…");
      tarball = join(work, "archive.tar.gz");
      await decryptFile(options.archive, tarball, options.passphrase);
    }
    const content = join(work, "content");
    await mkdir(content);
    await run("tar", ["-xzf", tarball, "-C", content]).catch(() => {
      throw new RestoreRefusedError("This file isn't a Spine backup, or it's damaged.");
    });
    const manifest = JSON.parse(await readFile(join(content, "manifest.json"), "utf8").catch(() => "null")) as BackupManifest | null;
    if (!manifest?.database) throw new RestoreRefusedError("This file isn't a Spine backup: it has no manifest.");
    if (manifest.format > BACKUP_FORMAT) throw new RestoreRefusedError(`This backup was made by a newer Spine (${manifest.spineVersion}). Upgrade this install to ${manifest.spineVersion} or later first (./upgrade.sh), then restore.`);
    const current = spineVersion();
    if (compareVersions(manifest.spineVersion, current) > 0) {
      throw new RestoreRefusedError(`This backup is from Spine ${manifest.spineVersion}, which is newer than this install (Spine ${current}). Upgrade this install to ${manifest.spineVersion} or later first (./upgrade.sh), then restore.`);
    }

    log("Checking every file in the backup…");
    if ((await sha256File(join(content, manifest.database.file))) !== manifest.database.sha256) throw new RestoreRefusedError("The backup is damaged: the database dump doesn't match its checksum. Nothing was changed.");
    for (const entry of manifest.files.entries) {
      const sum = await sha256File(join(content, "files", entry.id)).catch(() => null);
      if (sum !== entry.sha256) throw new RestoreRefusedError(`The backup is damaged: ${entry.key} is missing or doesn't match its checksum. Nothing was changed.`);
    }

    const here = authSecretFingerprint();
    if (manifest.authSecretFingerprint && here && manifest.authSecretFingerprint !== here && !options.newSecret) {
      throw new RestoreRefusedError(
        "This install's AUTH_SECRET isn't the one the backup was made with, so two-factor sign-in and stored keys (such as the AI provider's) would stop working. Put the old install's AUTH_SECRET in .env and run the restore again — or pass --new-secret to restore anyway (people then set up two-factor again, and stored keys are entered again).",
      );
    }

    const sql = postgres(options.databaseUrl, { max: 1, onnotice: () => {} });
    try {
      const [existing] = await sql<{ n: number }[]>`select count(*)::int as n from public.organization`.catch(() => [{ n: 0 }]);
      if ((existing?.n ?? 0) > 0 && !options.replace) {
        throw new RestoreRefusedError(`This install already has data (${existing!.n} organisation${existing!.n === 1 ? "" : "s"}). Restore into a clean install, or pass --replace to delete everything here and put the backup in its place.`);
      }
      log("Replacing the database…");
      await sql.unsafe("drop schema if exists pgboss cascade; drop schema if exists drizzle cascade; drop schema if exists public cascade; create schema public;");
    } finally {
      await sql.end();
    }
    // The dump goes in on stdin, so pg_restore can run anywhere that reaches the database.
    await run(options.pgRestore ?? "pg_restore", ["--no-owner", "--no-privileges", "--exit-on-error", "--dbname", options.databaseUrl], join(content, manifest.database.file));

    log(`Putting back ${manifest.files.count} file${manifest.files.count === 1 ? "" : "s"}…`);
    const moved: { id: string; driver: StorageDriverName }[] = [];
    for (const entry of manifest.files.entries) {
      const own = options.readers[entry.driver];
      const target = own ?? options.primary;
      if (!target) throw new Error(`There's nowhere to put ${entry.key}: this install has no ${entry.driver} storage and no other storage set up.`);
      await target.delete(entry.key).catch((err: unknown) => {
        if (!(err instanceof StoredObjectMissingError)) throw err;
      });
      await target.save(entry.key, createReadStream(join(content, "files", entry.id)), "application/octet-stream");
      // Read back what was written: a file only counts as restored when its checksum matches.
      const written = createHash("sha256");
      await pipeline(await target.openReadStream(entry.key), written);
      if (written.digest("hex") !== entry.sha256) throw new Error(`${entry.key} didn't store correctly: what was written doesn't match its checksum.`);
      if (!own) moved.push({ id: entry.id, driver: options.primaryName });
    }
    if (moved.length) {
      const sql2 = postgres(options.databaseUrl, { max: 1, onnotice: () => {} });
      try {
        for (const m of moved) await sql2`update files set storage_driver = ${m.driver} where id = ${m.id}`;
      } finally {
        await sql2.end();
      }
    }
    return { manifest, files: manifest.files.entries.length };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
