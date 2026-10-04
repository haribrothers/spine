import { and, asc, eq, gt } from "drizzle-orm";
import type { Readable } from "node:stream";
import type { Database } from "../../db/client";
import { files } from "../../db/schema";
import { sha256 } from "./files.service";
import { type StorageDriver, type StorageDriverName, StoredObjectMissingError, fileKey } from "./storage/storage-driver";

export interface MigrationFailure {
  fileId: string;
  key: string;
  reason: string;
}

export interface MigrationResult {
  copied: number;
  skipped: number;
  failed: MigrationFailure[];
}

const PAGE_SIZE = 200;

async function readAll(driver: StorageDriver, key: string): Promise<Buffer | null> {
  let stream: Readable;
  try {
    stream = await driver.openReadStream(key);
  } catch (err) {
    if (err instanceof StoredObjectMissingError) return null;
    throw err;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

/**
 * US-OPS-30 — copies every file recorded on the `from` driver to the `to`
 * driver, verifies the copy against the file's checksum, then points the
 * row at the new driver and key (new keys are built from ids, D-104). The
 * source is never modified or deleted, so a failed run changes nothing for
 * the files that failed and can simply be run again.
 *
 * Idempotent: rows already on `to` count as skipped, and a copy already
 * present at the target with a matching checksum is reused rather than
 * written again.
 */
export async function migrateFiles(
  db: Database,
  source: StorageDriver,
  target: StorageDriver,
  options: { orgId?: string; log?: (line: string) => void } = {},
): Promise<MigrationResult> {
  const log = options.log ?? (() => undefined);
  const result: MigrationResult = { copied: 0, skipped: 0, failed: [] };
  const orgFilter = options.orgId ? eq(files.orgId, options.orgId) : undefined;

  const alreadyMoved = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.storageDriver, target.name), orgFilter));
  result.skipped += alreadyMoved.length;

  let lastId: string | null = null;
  for (;;) {
    const page: (typeof files.$inferSelect)[] = await db
      .select()
      .from(files)
      .where(and(eq(files.storageDriver, source.name), orgFilter, lastId ? gt(files.id, lastId) : undefined))
      .orderBy(asc(files.id))
      .limit(PAGE_SIZE);
    if (!page.length) break;
    lastId = page[page.length - 1]!.id;

    for (const file of page) {
      const fail = (reason: string) => {
        result.failed.push({ fileId: file.id, key: file.key, reason });
        log(`FAILED ${file.id} (${file.key}): ${reason}`);
      };
      try {
        const bytes = await readAll(source, file.key);
        if (!bytes) {
          fail(`missing from ${source.name}`);
          continue;
        }
        const checksum = sha256(bytes);
        if (file.checksumSha256 && checksum !== file.checksumSha256) {
          fail(`checksum mismatch in ${source.name} (the stored file is damaged)`);
          continue;
        }

        const newKey = fileKey(file.orgId, file.id);
        const existing = await readAll(target, newKey);
        if (existing && sha256(existing) !== checksum) {
          fail(`a different file is already stored at ${target.name}:${newKey}`);
          continue;
        }
        if (!existing) {
          await target.save(newKey, bytes, file.mimeType);
          const copy = await readAll(target, newKey);
          if (!copy || sha256(copy) !== checksum) {
            fail(`the copy in ${target.name} doesn't match the original`);
            continue;
          }
        }

        await db
          .update(files)
          .set({ storageDriver: target.name as StorageDriverName, key: newKey, checksumSha256: checksum })
          .where(eq(files.id, file.id));
        if (existing) {
          result.skipped++;
          log(`skipped ${file.id}: already copied`);
        } else {
          result.copied++;
          log(`copied ${file.id}`);
        }
      } catch (err) {
        fail((err as Error).message);
      }
    }
  }
  return result;
}
