import { Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { files } from "../../db/schema";
import { MAX_FILE_LINK_SECONDS, signFileLink } from "./file-link";
import { createStorageDrivers, type StorageDrivers } from "./storage/storage-config";
import { type ByteRange, type StorageDriver, StoredObjectMissingError, fileKey } from "./storage/storage-driver";

export interface UploadFileInput {
  originalFilename: string;
  mimeType: string;
  buffer: Buffer;
  uploadedByUserId: string | null;
}

export type FileRow = typeof files.$inferSelect;

/** How `GET /files/:id` answers: stream the bytes (`local`) or redirect to a presigned URL (`s3`). */
export type FileDownload =
  | { kind: "stream"; file: FileRow; stream: Readable }
  | { kind: "redirect"; file: FileRow; url: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Owns the `files` rows and every read and write of file bytes (D-102).
 * Bytes go through a `StorageDriver`: `local` (the `spine_files` volume) by
 * default, `s3` when `STORAGE_DRIVER=s3`. Each row records the driver that
 * stored it, so files stay readable after an owner switches drivers.
 *
 * Storage problems degrade the file feature with a 503, never the process.
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly drivers: StorageDrivers = createStorageDrivers();

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  isStorageConfigured(): boolean {
    return this.drivers.primary !== null;
  }

  async upload(orgId: string, input: UploadFileInput): Promise<FileRow> {
    const driver = this.drivers.primary;
    if (!driver) {
      throw new ServiceUnavailableException(
        "File storage isn't set up on this server, so files can't be uploaded. Ask the owner to check the storage settings.",
      );
    }

    const id = randomUUID();
    const key = fileKey(orgId, id);
    try {
      await driver.save(key, input.buffer, input.mimeType);
    } catch (err) {
      this.logger.error(`Could not save file ${id} with the ${driver.name} driver: ${(err as Error).message}`);
      throw new ServiceUnavailableException("The file couldn't be saved. Try again; if it keeps failing, ask the owner to check the server's storage.");
    }

    try {
      const [row] = await this.db
        .insert(files)
        .values({
          id,
          orgId,
          key,
          storageDriver: driver.name,
          originalFilename: input.originalFilename,
          mimeType: input.mimeType,
          sizeBytes: input.buffer.byteLength,
          uploadedByUserId: input.uploadedByUserId,
        })
        .returning();
      return row!;
    } catch (err) {
      // No row points at the bytes, so nothing could ever serve them.
      await driver.delete(key).catch(() => undefined);
      throw err;
    }
  }

  async getMetadata(orgId: string, id: string): Promise<FileRow> {
    if (!UUID.test(id)) throw new NotFoundException("File not found");
    const [row] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.orgId, orgId), eq(files.id, id)));
    if (!row) throw new NotFoundException("File not found");
    return row;
  }

  /** For a request carrying a verified signed link instead of a session. */
  async getMetadataForSignedLink(id: string): Promise<FileRow> {
    if (!UUID.test(id)) throw new NotFoundException("File not found");
    const [row] = await this.db.select().from(files).where(eq(files.id, id));
    if (!row) throw new NotFoundException("File not found");
    return row;
  }

  /** Bytes for `GET /files/:id`, after the caller has checked who may read `file`. */
  async download(file: FileRow, range?: ByteRange): Promise<FileDownload> {
    const driver = this.readerFor(file);
    if (driver.presignedUrl) {
      return { kind: "redirect", file, url: await driver.presignedUrl(file.key, MAX_FILE_LINK_SECONDS) };
    }
    return { kind: "stream", file, stream: await this.open(driver, file, range) };
  }

  /** The whole file in memory — for small files the server itself embeds, such as a logo in a PDF. */
  async readBytes(orgId: string, id: string): Promise<{ bytes: Buffer; mimeType: string }> {
    const file = await this.getMetadata(orgId, id);
    const stream = await this.open(this.readerFor(file), file);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    return { bytes: Buffer.concat(chunks), mimeType: file.mimeType };
  }

  /** `exp` and `sig` for a session-less `GET /files/:id` link, valid for at most 5 minutes. */
  signLink(fileId: string, ttlSeconds?: number): { exp: number; sig: string } {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new ServiceUnavailableException("AUTH_SECRET is not set, so file links can't be signed.");
    return signFileLink(fileId, secret, ttlSeconds);
  }

  private readerFor(file: FileRow): StorageDriver {
    const driver = this.drivers.readers[file.storageDriver as keyof StorageDrivers["readers"]];
    if (!driver) {
      throw new ServiceUnavailableException(
        "This file is stored in S3, which isn't set up on this server. Ask the owner to check the storage settings.",
      );
    }
    return driver;
  }

  private async open(driver: StorageDriver, file: FileRow, range?: ByteRange): Promise<Readable> {
    try {
      return await driver.openReadStream(file.key, range);
    } catch (err) {
      if (err instanceof StoredObjectMissingError) {
        this.logger.error(`File ${file.id} has a record but no stored bytes (${driver.name} driver)`);
        throw new NotFoundException("File not found");
      }
      this.logger.error(`Could not read file ${file.id} with the ${driver.name} driver: ${(err as Error).message}`);
      throw new ServiceUnavailableException("The file couldn't be opened. Try again; if it keeps failing, ask the owner to check the server's storage.");
    }
  }
}
