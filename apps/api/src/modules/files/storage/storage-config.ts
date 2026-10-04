import { Logger } from "@nestjs/common";
import path from "node:path";
import { LocalStorageDriver } from "./local-storage.driver";
import { S3StorageDriver, getS3Config } from "./s3-storage.driver";
import type { StorageDriver, StorageDriverName } from "./storage-driver";

export interface StorageDrivers {
  /** Where new uploads go; `null` when `STORAGE_DRIVER=s3` but S3 isn't configured. */
  primary: StorageDriver | null;
  /** Every driver that can read existing files, by the name stored on each `files` row. */
  readers: Partial<Record<StorageDriverName, StorageDriver>>;
}

const logger = new Logger("Storage");

/**
 * `FILES_DIR` when set (relative paths resolve against the working
 * directory). Otherwise `/data/files` — the `spine_files` volume — in
 * production, and `.data/files` under the working directory in development,
 * where `/data` usually isn't writable.
 */
export function resolveFilesDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.FILES_DIR) return path.resolve(env.FILES_DIR);
  return env.NODE_ENV === "production" ? "/data/files" : path.resolve(".data/files");
}

/**
 * Picks the upload driver from `STORAGE_DRIVER` (`local` by default, D-102).
 * The `s3` driver is also built whenever `S3_*` is set, even with `local`
 * selected, so files uploaded before a switch stay readable.
 */
export function createStorageDrivers(env: NodeJS.ProcessEnv = process.env): StorageDrivers {
  const local = new LocalStorageDriver(resolveFilesDir(env));
  const s3Config = getS3Config(env);
  const s3 = s3Config ? new S3StorageDriver(s3Config) : undefined;

  const requested = (env.STORAGE_DRIVER ?? "local").trim().toLowerCase() || "local";
  let primary: StorageDriver | null = local;
  if (requested === "s3") {
    primary = s3 ?? null;
    if (!s3) logger.warn("STORAGE_DRIVER=s3 but S3_ENDPOINT is not set — uploads are unavailable until it is.");
  } else if (requested !== "local") {
    logger.warn(`Unknown STORAGE_DRIVER "${env.STORAGE_DRIVER}" — using the local driver.`);
  }

  return { primary, readers: { local, ...(s3 ? { s3 } : {}) } };
}
