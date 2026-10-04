import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { and, asc, eq, gt, inArray, isNotNull, isNull } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { statfs } from "node:fs/promises";
import { STORAGE_FULL_MESSAGE, type StorageStatus } from "@spine/shared";
import type { Readable } from "node:stream";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { contactPersons, contacts, expenses, files, invoices, jobPhotos, jobs, quotes, settings } from "../../db/schema";
import { MAX_FILE_LINK_SECONDS, signFileLink } from "./file-link";
import { UNSUPPORTED_TYPE_MESSAGE, sniffMimeType, stripGpsLocation } from "./upload-safety";
import { createStorageDrivers, resolveFilesDir, type StorageDrivers } from "./storage/storage-config";
import { type ByteRange, type StorageDriver, StoredObjectMissingError, fileKey } from "./storage/storage-driver";

export interface UploadFileInput {
  originalFilename: string;
  mimeType: string;
  buffer: Buffer;
  uploadedByUserId: string | null;
}

export type FileRow = typeof files.$inferSelect;

export type IntegrityProblem = "damaged" | "missing";

/** US-OPS-28 — the 409 every damaged or missing file returns. */
const INLINE_TYPES = new Set<string>(["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]);

export const DAMAGED_FILE_MESSAGE = "This file is damaged. Restore it from your latest backup.";

/**
 * US-OPS-29 — the allowed photo types and PDFs open in the browser;
 * anything else (only files stored before type checks existed, such as an
 * SVG that could carry script) downloads instead of rendering.
 */
export function contentDisposition(file: Pick<FileRow, "mimeType" | "originalFilename">): string {
  const inline = INLINE_TYPES.has(file.mimeType);
  const name = file.originalFilename.replace(/[\r\n"\\]/g, "_");
  const ascii = name.replace(/[^\x20-\x7e]/g, "_");
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** How `GET /files/:id` answers: stream the bytes (`local`) or redirect to a presigned URL (`s3`). */
export type FileDownload =
  | { kind: "stream"; file: FileRow; stream: Readable }
  | { kind: "redirect"; file: FileRow; url: string };

/** US-OPS-31 — how often the files volume is measured. */
const USAGE_CACHE_MS = 15 * 60 * 1000;

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

  private usage: StorageStatus | null = null;
  private usageCheckedAt = 0;

  /**
   * US-OPS-31 — how full the files volume is, for `/health/ready` and the
   * Owners' banner. Measured with `statfs` at most every 15 minutes (or
   * straight after a full-disk upload). `usedPercent` is null for the `s3`
   * driver, or when the volume can't be measured.
   */
  async storageStatus(now = Date.now()): Promise<StorageStatus> {
    const driver = this.drivers.primary ?? this.drivers.readers.local!;
    if (driver.name === "s3") return { driver: "s3", usedPercent: null };
    if (this.usage && now - this.usageCheckedAt < USAGE_CACHE_MS) return this.usage;
    let usedPercent: number | null = null;
    try {
      const stats = await statfs(resolveFilesDir());
      const used = stats.blocks - stats.bfree;
      const usable = used + stats.bavail;
      usedPercent = usable > 0 ? Math.round((used / usable) * 1000) / 10 : null;
    } catch (err) {
      this.logger.warn(`Could not measure the files volume: ${(err as Error).message}`);
    }
    this.usage = { driver: "local", usedPercent };
    this.usageCheckedAt = now;
    return this.usage;
  }

  async upload(orgId: string, input: UploadFileInput): Promise<FileRow> {
    const driver = this.drivers.primary;
    if (!driver) {
      throw new ServiceUnavailableException(
        "File storage isn't set up on this server, so files can't be uploaded. Ask the owner to check the storage settings.",
      );
    }

    // US-OPS-29: the type comes from the bytes, never the name or the
    // browser's claim, and photos lose their GPS location before storage.
    const mimeType = sniffMimeType(input.buffer);
    if (!mimeType) throw new UnsupportedMediaTypeException(UNSUPPORTED_TYPE_MESSAGE);
    const bytes = stripGpsLocation(input.buffer, mimeType);

    const id = randomUUID();
    const key = fileKey(orgId, id);
    try {
      await driver.save(key, bytes, mimeType);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOSPC" || code === "EDQUOT") {
        this.logger.error(`Could not save file ${id}: the files volume is full`);
        this.usageCheckedAt = 0; // re-measure so the Owners' banner shows straight away
        throw new HttpException(STORAGE_FULL_MESSAGE, HttpStatus.INSUFFICIENT_STORAGE);
      }
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
          checksumSha256: sha256(bytes),
          // A display label only — never part of a path (D-104).
          originalFilename: input.originalFilename,
          mimeType,
          sizeBytes: bytes.byteLength,
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
  /**
   * Bytes for `GET /files/:id`, after the caller has checked who may read
   * `file`. Streamed (`local`) files are verified against their checksum
   * first; a damaged or missing file is a 409 and is flagged for the
   * owners' dashboard. Presigned (`s3`) files aren't downloaded on every
   * read — the weekly check verifies them — but one already flagged is
   * refused the same way.
   */
  async download(file: FileRow, range?: ByteRange): Promise<FileDownload> {
    const driver = this.readerFor(file);
    if (driver.presignedUrl) {
      if (file.integrityProblem) throw new ConflictException(DAMAGED_FILE_MESSAGE);
      const url = await driver.presignedUrl(file.key, MAX_FILE_LINK_SECONDS, {
        contentType: file.mimeType,
        contentDisposition: contentDisposition(file),
      });
      return { kind: "redirect", file, url };
    }
    const problem = await this.verify(file);
    if (problem) throw new ConflictException(DAMAGED_FILE_MESSAGE);
    return { kind: "stream", file, stream: await this.open(driver, file, range) };
  }

  /** The whole file in memory — for small files the server itself embeds, such as a logo in a PDF. */
  async readBytes(orgId: string, id: string): Promise<{ bytes: Buffer; mimeType: string }> {
    const file = await this.getMetadata(orgId, id);
    const bytes = await this.readStored(file);
    if (bytes === null || (file.checksumSha256 && sha256(bytes) !== file.checksumSha256)) {
      await this.recordCheck(file, bytes === null ? "missing" : "damaged");
      throw new ConflictException(DAMAGED_FILE_MESSAGE);
    }
    return { bytes, mimeType: file.mimeType };
  }

  /**
   * Checks the stored bytes against the recorded checksum and records the
   * outcome on the row. A file stored before checksums existed gets its
   * checksum from its current bytes (the one-off backfill). Returns the
   * problem, or null when the file is intact.
   */
  async verify(file: FileRow): Promise<IntegrityProblem | null> {
    let bytes: Buffer | null;
    try {
      bytes = await this.readStored(file);
    } catch (err) {
      // The store itself is unreachable: that's an outage, not damage.
      this.logger.warn(`Could not check file ${file.id}: ${(err as Error).message}`);
      return file.integrityProblem as IntegrityProblem | null;
    }
    if (bytes === null) return this.recordCheck(file, "missing");
    const actual = sha256(bytes);
    if (!file.checksumSha256) {
      await this.db.update(files).set({ checksumSha256: actual }).where(eq(files.id, file.id));
      file.checksumSha256 = actual;
      return this.recordCheck(file, null);
    }
    return this.recordCheck(file, actual === file.checksumSha256 ? null : "damaged");
  }

  async hasFilesWithoutChecksum(): Promise<boolean> {
    const [row] = await this.db.select({ id: files.id }).from(files).where(isNull(files.checksumSha256)).limit(1);
    return Boolean(row);
  }

  /** Every file, a page at a time, for the weekly check. */
  async listAfter(lastId: string | null, limit: number): Promise<FileRow[]> {
    return this.db
      .select()
      .from(files)
      .where(lastId ? gt(files.id, lastId) : undefined)
      .orderBy(asc(files.id))
      .limit(limit);
  }

  /** The owners' dashboard warning: files whose last check failed. */
  async integritySummary(orgId: string): Promise<{ problemCount: number; files: { id: string; problem: IntegrityProblem; label: string }[] }> {
    const rows = await this.db
      .select()
      .from(files)
      .where(and(eq(files.orgId, orgId), isNotNull(files.integrityProblem)));
    const labels = await this.describe(orgId, rows);
    return {
      problemCount: rows.length,
      files: rows.map((row) => ({ id: row.id, problem: row.integrityProblem as IntegrityProblem, label: labels.get(row.id)! })),
    };
  }

  /**
   * What each file belongs to, in words an owner recognises ("Receipt for
   * expense: Fuel"), so the notification names records rather than file ids.
   */
  async describe(orgId: string, rows: FileRow[]): Promise<Map<string, string>> {
    const labels = new Map(rows.map((row) => [row.id, `File “${row.originalFilename}”`]));
    const ids = rows.map((row) => row.id);
    if (!ids.length) return labels;
    const set = (id: string | null, label: string) => {
      if (id && labels.has(id)) labels.set(id, label);
    };
    const [invoiceRows, quoteRows, expenseRows, photoRows, contactRows, personRows] = await Promise.all([
      this.db.select({ id: invoices.pdfFileId, number: invoices.number }).from(invoices).where(and(eq(invoices.orgId, orgId), inArray(invoices.pdfFileId, ids))),
      this.db.select({ id: quotes.pdfFileId, number: quotes.number }).from(quotes).where(and(eq(quotes.orgId, orgId), inArray(quotes.pdfFileId, ids))),
      this.db.select({ id: expenses.receiptFileId, number: expenses.number, description: expenses.description }).from(expenses).where(and(eq(expenses.orgId, orgId), inArray(expenses.receiptFileId, ids))),
      this.db.select({ id: jobPhotos.fileId, name: jobs.name }).from(jobPhotos).innerJoin(jobs, eq(jobPhotos.jobId, jobs.id)).where(and(eq(jobPhotos.orgId, orgId), inArray(jobPhotos.fileId, ids))),
      this.db.select({ id: contacts.logoFileId, name: contacts.name }).from(contacts).where(and(eq(contacts.orgId, orgId), inArray(contacts.logoFileId, ids))),
      this.db.select({ id: contactPersons.logoFileId, name: contactPersons.name }).from(contactPersons).where(inArray(contactPersons.logoFileId, ids)),
    ]);
    for (const r of invoiceRows) set(r.id, `PDF of invoice ${r.number ?? "(draft)"}`);
    for (const r of quoteRows) set(r.id, `PDF of quote ${r.number ?? "(draft)"}`);
    for (const r of expenseRows) set(r.id, `Receipt for expense ${[r.number, r.description].filter(Boolean).join(": ") || "(no description)"}`);
    for (const r of photoRows) set(r.id, `Photo on job: ${r.name}`);
    for (const r of contactRows) set(r.id, `Logo of ${r.name}`);
    for (const r of personRows) set(r.id, `Photo of ${r.name}`);
    const [profile] = await this.db
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.orgId, orgId), eq(settings.key, "business_profile")));
    const logoId = (profile?.value as { logoUrl?: string } | undefined)?.logoUrl?.match(/\/files\/([0-9a-f-]{36})/i)?.[1];
    set(logoId ?? null, "Business logo");
    return labels;
  }

  private async recordCheck(file: FileRow, problem: IntegrityProblem | null): Promise<IntegrityProblem | null> {
    if (problem) this.logger.error(`File ${file.id} is ${problem} (${file.storageDriver} driver)`);
    await this.db
      .update(files)
      .set({ integrityProblem: problem, integrityCheckedAt: new Date() })
      .where(eq(files.id, file.id));
    file.integrityProblem = problem;
    return problem;
  }

  /** The whole stored file, or null when the driver has no object for it. */
  private async readStored(file: FileRow): Promise<Buffer | null> {
    const driver = this.readerFor(file);
    let stream: Readable;
    try {
      stream = await driver.openReadStream(file.key);
    } catch (err) {
      if (err instanceof StoredObjectMissingError) return null;
      throw err;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    return Buffer.concat(chunks);
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
