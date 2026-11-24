/**
 * US-OPS-03 (D-105) — `scripts/backup.sh` runs this inside the API container:
 *
 *   node apps/api/dist/scripts/backup.js --output /tmp/spine-backup-20261023-020000.tar.gz
 *
 * Writes the archive (encrypted when BACKUP_PASSPHRASE is set, the name then
 * ending .tar.gz.enc), uploads it when BACKUP_REMOTE is set (only encrypted
 * archives go off the machine) and prunes old remote copies, then records the
 * time as every organisation's last backup. Exits 1, leaving no partial file,
 * on any failure.
 *
 *   node apps/api/dist/scripts/backup.js --remote-only
 *
 * names the archive itself, uploads it (BACKUP_REMOTE and BACKUP_PASSPHRASE
 * are required) and keeps no local copy — for a platform's scheduled task,
 * such as Coolify's (the Coolify guide in the self-hosting docs).
 */
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb } from "../db/client";
import { createStorageDrivers } from "../modules/files/storage/storage-config";
import { createBackup } from "../ops/backup/backup";
import { recordBackup } from "../ops/backup/backup-status";
import { remoteConfig, uploadAndPrune } from "../ops/backup/remote";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const say = (line: string) => process.stderr.write(`${line}\n`);

async function main(): Promise<number> {
  const remoteOnly = process.argv.includes("--remote-only");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const output = remoteOnly ? join(tmpdir(), `spine-backup-${stamp}.tar.gz.enc`) : arg("output");
  if (!output || !/spine-backup-\d{8}-\d{6}\.tar\.gz(\.enc)?$/.test(output)) {
    say("Usage: backup.js --output <folder>/spine-backup-<YYYYMMDD-HHMMSS>.tar.gz[.enc]");
    return 2;
  }
  if (!process.env.DATABASE_URL) {
    say("DATABASE_URL is not set.");
    return 2;
  }
  const passphrase = process.env.BACKUP_PASSPHRASE || undefined;
  if (remoteOnly && (!process.env.BACKUP_REMOTE || !passphrase)) {
    say("--remote-only copies the backup off this machine and keeps none here, so it needs BACKUP_REMOTE (and its keys) and BACKUP_PASSPHRASE.");
    return 1;
  }
  if (Boolean(passphrase) !== output.endsWith(".enc")) {
    say(passphrase ? "With a passphrase the archive's name ends in .tar.gz.enc." : "Without a passphrase the archive's name ends in .tar.gz.");
    return 2;
  }
  const remote = remoteConfig();
  if (remote && !passphrase) {
    say("BACKUP_REMOTE is set, but backups are only copied off this machine encrypted. Set BACKUP_PASSPHRASE (or use --passphrase) and run it again.");
    return 1;
  }

  const db = createDb(process.env.DATABASE_URL);
  const now = new Date();
  const result = await createBackup({ db, databaseUrl: process.env.DATABASE_URL, readers: createStorageDrivers().readers, output, passphrase, pgDump: process.env.PG_DUMP, log: say, now });
  say(`Backed up the database and ${result.manifest.files.count} file${result.manifest.files.count === 1 ? "" : "s"}.`);
  if (remote) {
    say(`Copying it to s3://${remote.bucket}/${remote.prefix}…`);
    const { key, pruned } = await uploadAndPrune(remote, result.path);
    say(`Copied.${pruned ? ` Removed ${pruned} older cop${pruned === 1 ? "y" : "ies"} (7 daily and 4 weekly are kept).` : ""}`);
    if (remoteOnly) {
      await rm(result.path, { force: true });
      say(`Backup saved: s3://${remote.bucket}/${key}`);
    }
  }
  await recordBackup(db, now);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    say(`The backup failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
