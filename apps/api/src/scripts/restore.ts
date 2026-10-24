/**
 * US-OPS-04 — `scripts/restore.sh` runs this in a one-off API container while
 * Spine is stopped, with the archive on stdin:
 *
 *   node apps/api/dist/scripts/restore.js --archive - [--replace] [--new-secret] < backup.tar.gz
 *
 * Exits 3 with the reason, having changed nothing, when it refuses (wrong or
 * missing passphrase, a backup from a newer Spine, a damaged file, an install
 * that already has data, a different AUTH_SECRET); 1 if it failed part-way.
 */
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createStorageDrivers } from "../modules/files/storage/storage-config";
import type { StorageDriverName } from "../modules/files/storage/storage-driver";
import { WrongPassphraseError } from "../ops/backup/archive-crypto";
import { RestoreRefusedError, restoreBackup } from "../ops/backup/restore";

const say = (line: string) => process.stderr.write(`${line}\n`);
/** restore.sh tells "nothing changed" from "failed part-way" by this exit code. */
const REFUSED = 3;
const flag = (name: string) => process.argv.includes(`--${name}`);

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<number> {
  const archiveArg = arg("archive");
  if (!archiveArg) {
    say("Usage: restore.js --archive <file>|- [--replace] [--new-secret]");
    return 2;
  }
  if (!process.env.DATABASE_URL) {
    say("DATABASE_URL is not set.");
    return 2;
  }
  let archive = archiveArg;
  let received: string | null = null;
  if (archiveArg === "-") {
    received = await mkdtemp(join(tmpdir(), "spine-restore-in-"));
    archive = join(received, "backup");
    await pipeline(process.stdin, createWriteStream(archive));
  }
  try {
    const drivers = createStorageDrivers();
    const primaryName = ((process.env.STORAGE_DRIVER ?? "local").trim().toLowerCase() === "s3" ? "s3" : "local") as StorageDriverName;
    const result = await restoreBackup({
      archive,
      databaseUrl: process.env.DATABASE_URL,
      readers: drivers.readers,
      primary: drivers.primary,
      primaryName,
      passphrase: process.env.BACKUP_PASSPHRASE || undefined,
      replace: flag("replace"),
      newSecret: flag("new-secret"),
      pgRestore: process.env.PG_RESTORE,
      log: say,
    });
    const missing = result.manifest.files.missing.length;
    say(`Restored the backup from ${result.manifest.createdAt} (Spine ${result.manifest.spineVersion}): the database and ${result.files} file${result.files === 1 ? "" : "s"}.`);
    if (missing) say(`${missing} file${missing === 1 ? " was" : "s were"} already missing when the backup was made, so ${missing === 1 ? "it isn't" : "they aren't"} back.`);
    return 0;
  } catch (err) {
    if (err instanceof RestoreRefusedError || err instanceof WrongPassphraseError) {
      say(err.message);
      return REFUSED;
    }
    throw err;
  } finally {
    if (received) await rm(received, { recursive: true, force: true });
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    say(`The restore failed part-way: ${err instanceof Error ? err.message : String(err)}`);
    say("Run it again with --replace once the cause is fixed.");
    process.exit(1);
  });
