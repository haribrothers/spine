/**
 * US-OPS-30 — `pnpm --filter @spine/api files:migrate --from s3 --to local`
 *
 * Copies every file stored with one driver to the other, verifies each
 * copy, and switches the file records over. The source bucket or folder is
 * never changed. Prints copied/skipped/failed counts; exits 1 if anything
 * failed (run it again once the cause is fixed — finished files are skipped).
 * `--org <id>` limits the run to one organisation.
 */
import { createDb } from "../db/client";
import { migrateFiles } from "../modules/files/migrate-files";
import { createStorageDrivers } from "../modules/files/storage/storage-config";
import type { StorageDriverName } from "../modules/files/storage/storage-driver";

const DRIVERS: StorageDriverName[] = ["local", "s3"];

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<number> {
  const from = arg("from") as StorageDriverName | undefined;
  const to = arg("to") as StorageDriverName | undefined;
  if (!from || !to || !DRIVERS.includes(from) || !DRIVERS.includes(to) || from === to) {
    console.error("Usage: files:migrate --from s3|local --to local|s3 [--org <organisation id>]");
    return 2;
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    return 2;
  }

  const { readers } = createStorageDrivers();
  const source = readers[from];
  const target = readers[to];
  if (!source || !target) {
    console.error("The s3 driver needs S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY and S3_SECRET_KEY to be set.");
    return 2;
  }

  const db = createDb(process.env.DATABASE_URL);
  console.log(`Moving files from ${from} to ${to}. Nothing is deleted from ${from}.`);
  const result = await migrateFiles(db, source, target, { orgId: arg("org"), log: (line) => console.log(line) });
  console.log(`\nCopied: ${result.copied}  Skipped (already in ${to}): ${result.skipped}  Failed: ${result.failed.length}`);
  if (result.failed.length) {
    console.error("\nThese files were not moved (their records still point at the old storage):");
    for (const failure of result.failed) console.error(`- ${failure.fileId} (${failure.key}): ${failure.reason}`);
    return 1;
  }
  console.log(`\nDone. Set STORAGE_DRIVER=${to} and restart the API.`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
