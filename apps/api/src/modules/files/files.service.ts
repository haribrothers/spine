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
import { and, asc, eq, gt, inArray, isNotNull, isNull, like } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { statfs } from "node:fs/promises";
import { STORAGE_FULL_MESSAGE, type StorageStatus } from "@spine/shared";
import { Transform, type Readable } from "node:stream";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import {
  attachments,
  dataExports,
  contactPersons,
  contacts,
  creditNotes,
  expenses,
  files,
  invoices,
  jobAssignments,
  jobPhotos,
  jobs,
  jobVariationOrders,
  member,
  payments,
  quotes,
  settings,
  user,
} from "../../db/schema";
import { getMemberRole } from "../../auth/capability.util";
import { loadAttachmentRecord, recordAccess } from "../attachments/attachment-records";
import type { AttachmentEntityType } from "@spine/shared";
import { MAX_FILE_LINK_SECONDS, signFileLink } from "./file-link";
import { UNSUPPORTED_TYPE_MESSAGE, sniffMimeType, stripGpsLocation } from "./upload-safety";
import { registerEmailLogoReader } from "../email/email-brand";
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

/** A record a file belongs to (US-OPS-20). For `job_photo`, `id` is the job's id. */
export type FileOwner =
  | { type: "invoice_pdf" | "credit_note_pdf" | "receipt_pdf" | "quote_pdf" | "job_photo" | "contact_logo" | "contact_person_photo" | "user_avatar" | "business_logo" | "document_signature" | "quote_signature"; id: string }
  | { type: "expense_receipt"; id: string; submittedBy: string | null }
  // US-OPS-34 (D-156): a file kept with a record follows that record's read rule; `id` is the record's.
  | { type: "attachment"; id: string; entityType: AttachmentEntityType };

/** US-OPS-28 — the 409 every damaged or missing file returns. */
const INLINE_TYPES = new Set<string>(["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]);

export const DAMAGED_FILE_MESSAGE = "This file is damaged. Restore it from your latest backup.";

/**
 * US-OPS-29 — the allowed photo types and PDFs open in the browser;
 * anything else (only files stored before type checks existed, such as an
 * SVG that could carry script) downloads instead of rendering.
 */
/** `download` (US-OPS-34, `?download=1`) saves the file instead of showing it. */
export function contentDisposition(file: Pick<FileRow, "mimeType" | "originalFilename">, download = false): string {
  const inline = !download && INLINE_TYPES.has(file.mimeType);
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

  constructor(@Inject(DATABASE) private readonly db: Database) {
    // US-NTF-10: emails embed the business logo through this service.
    registerEmailLogoReader((orgId, fileId) => this.readBytes(orgId, fileId));
  }

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
      // The folder this driver writes to, as configured when it was built.
      const dir = "root" in driver && typeof driver.root === "string" ? driver.root : resolveFilesDir();
      const stats = await statfs(dir);
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

  /**
   * US-SET-15 — stores a file the server built itself (a data export ZIP),
   * streamed straight to the storage driver with its size and checksum
   * worked out on the way. No type sniffing: the server chose the type.
   */
  async storeGenerated(orgId: string, source: Readable, input: { originalFilename: string; mimeType: string; uploadedByUserId: string | null }): Promise<FileRow> {
    const driver = this.drivers.primary;
    if (!driver) throw new ServiceUnavailableException("File storage isn't set up on this server. Ask the owner to check the storage settings.");
    const id = randomUUID();
    const key = fileKey(orgId, id);
    const hash = createHash("sha256");
    let size = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _enc, done) {
        hash.update(chunk);
        size += chunk.length;
        done(null, chunk);
      },
    });
    source.on("error", (err) => meter.destroy(err));
    await driver.save(key, source.pipe(meter), input.mimeType);
    try {
      const [row] = await this.db
        .insert(files)
        .values({ id, orgId, key, storageDriver: driver.name, checksumSha256: hash.digest("hex"), originalFilename: input.originalFilename, mimeType: input.mimeType, sizeBytes: size, uploadedByUserId: input.uploadedByUserId })
        .returning();
      return row!;
    } catch (err) {
      await driver.delete(key).catch(() => undefined);
      throw err;
    }
  }

  /** The stored bytes as a stream, for the server's own use (exports, data-export downloads). */
  async openStored(file: FileRow): Promise<Readable> {
    return this.open(this.readerFor(file), file);
  }

  /** US-SET-16 — deletes a file's bytes from storage and its row (an expired data export). */
  async deleteStored(orgId: string, id: string): Promise<void> {
    const [file] = await this.db.select().from(files).where(and(eq(files.orgId, orgId), eq(files.id, id)));
    if (!file) return;
    await this.readerFor(file).delete(file.key).catch((err) => this.logger.warn(`Could not delete stored file ${id}: ${(err as Error).message}`));
    await this.db.delete(files).where(eq(files.id, id));
  }

  /** Removes a file nothing points at yet (a duplicate made by a lost race). */
  async removeUnreferenced(orgId: string, id: string): Promise<void> {
    const file = await this.getMetadata(orgId, id);
    await this.db.delete(files).where(eq(files.id, id));
    await this.readerFor(file).delete(file.key).catch(() => undefined);
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

  /**
   * US-OPS-20 — a file is served only to someone who can read the record it
   * belongs to; anyone else gets a 404, as if it didn't exist.
   *
   * - Owners read every record, so every file in their organisation.
   * - A file not attached to anything yet (just uploaded, not saved) is
   *   readable only by whoever uploaded it, and by Owners.
   * - Staff read every record that holds files (07-security).
   * - Field read contact logos and photos, the business logo and members'
   *   avatars; photos on jobs they're assigned to; receipts on their own
   *   expenses; and quote PDFs for quotes on jobs they're assigned to
   *   (D-073). Never invoice, credit-note or receipt PDFs (US-JOB-19).
   *
   * The owning record is found from the columns and settings that point at
   * the file, not stored on the file itself (D-117).
   */
  async assertReadableBy(orgId: string, userId: string, file: FileRow): Promise<void> {
    const role = await getMemberRole(this.db, orgId, userId);
    if (!role) throw new NotFoundException("File not found");
    // US-SET-16: a data export is only ever served by its own Owner-checked, expiring download route.
    const [exportRow] = await this.db.select({ id: dataExports.id }).from(dataExports).where(eq(dataExports.fileId, file.id)).limit(1);
    if (exportRow) throw new NotFoundException("File not found");
    if (role === "owner") return;

    const owners = await this.owningRecords(orgId, file.id);
    if (!owners.length) {
      if (file.uploadedByUserId === userId) return;
      throw new NotFoundException("File not found");
    }
    for (const owner of owners) {
      if (owner.type === "attachment") {
        if (await this.attachmentReadable(orgId, userId, owner.entityType, owner.id)) return;
      } else if (role === "staff" || (role === "field" && (await this.fieldMayRead(orgId, userId, owner)))) {
        return;
      }
    }
    throw new NotFoundException("File not found");
  }

  /** Every record that points at this file. */
  async owningRecords(orgId: string, fileId: string): Promise<FileOwner[]> {
    const ids = [fileId];
    const [invoiceRows, creditNoteRows, paymentRows, quoteRows, expenseRows, photoRows, contactRows, personRows, profile, avatarRows, attachmentRows, signedQuoteRows] = await Promise.all([
      this.db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.orgId, orgId), inArray(invoices.issuedPdfFileId, ids))),
      this.db.select({ id: creditNotes.id }).from(creditNotes).where(and(eq(creditNotes.orgId, orgId), inArray(creditNotes.issuedPdfFileId, ids))),
      this.db.select({ id: payments.id }).from(payments).where(and(eq(payments.orgId, orgId), inArray(payments.issuedPdfFileId, ids))),
      this.db.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.orgId, orgId), inArray(quotes.issuedPdfFileId, ids))),
      this.db.select({ id: expenses.id, submittedBy: expenses.submittedByUserId }).from(expenses).where(and(eq(expenses.orgId, orgId), inArray(expenses.receiptFileId, ids))),
      this.db.select({ jobId: jobPhotos.jobId }).from(jobPhotos).where(and(eq(jobPhotos.orgId, orgId), inArray(jobPhotos.fileId, ids))),
      this.db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.orgId, orgId), inArray(contacts.logoFileId, ids))),
      this.db.select({ id: contactPersons.id }).from(contactPersons).innerJoin(contacts, eq(contactPersons.contactId, contacts.id)).where(and(eq(contacts.orgId, orgId), inArray(contactPersons.logoFileId, ids))),
      this.db.select({ key: settings.key, value: settings.value }).from(settings).where(and(eq(settings.orgId, orgId), inArray(settings.key, ["business_profile", "document_layout"]))),
      this.db.select({ id: user.id }).from(user).innerJoin(member, eq(member.userId, user.id)).where(and(eq(member.organizationId, orgId), like(user.image, `%/files/${fileId}%`))),
      this.db
        .select({ entityType: attachments.entityType, entityId: attachments.entityId })
        .from(attachments)
        .where(and(eq(attachments.orgId, orgId), inArray(attachments.fileId, ids), isNull(attachments.removedAt))),
      this.db.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.orgId, orgId), inArray(quotes.signatureFileId, ids))),
    ]);
    const owners: FileOwner[] = [
      ...invoiceRows.map((r) => ({ type: "invoice_pdf" as const, id: r.id })),
      ...creditNoteRows.map((r) => ({ type: "credit_note_pdf" as const, id: r.id })),
      ...paymentRows.map((r) => ({ type: "receipt_pdf" as const, id: r.id })),
      ...quoteRows.map((r) => ({ type: "quote_pdf" as const, id: r.id })),
      ...expenseRows.map((r) => ({ type: "expense_receipt" as const, id: r.id, submittedBy: r.submittedBy })),
      ...photoRows.map((r) => ({ type: "job_photo" as const, id: r.jobId })),
      ...contactRows.map((r) => ({ type: "contact_logo" as const, id: r.id })),
      ...personRows.map((r) => ({ type: "contact_person_photo" as const, id: r.id })),
      ...avatarRows.map((r) => ({ type: "user_avatar" as const, id: r.id })),
      ...attachmentRows.map((r) => ({ type: "attachment" as const, id: r.entityId, entityType: r.entityType })),
      // US-QUO-19: the customer's on-site signature — Owners and Staff read it with the quote; Field doesn't (the default below).
      ...signedQuoteRows.map((r) => ({ type: "quote_signature" as const, id: r.id })),
    ];
    const logoUrl = (profile.find((p) => p.key === "business_profile")?.value as { logoUrl?: string } | undefined)?.logoUrl;
    if (logoUrl?.includes(`/files/${fileId}`)) owners.push({ type: "business_logo", id: orgId });
    // US-SET-19: the signature Settings › Documents prints (Owner and Staff read it; Field never prints documents).
    const signatureFileId = (profile.find((p) => p.key === "document_layout")?.value as { signatureFileId?: string | null } | undefined)?.signatureFileId;
    if (signatureFileId === fileId) owners.push({ type: "document_signature", id: orgId });
    return owners;
  }

  /** US-OPS-34 — readers of the record read its attachments (Field: only their own expenses'). */
  private async attachmentReadable(orgId: string, userId: string, entityType: AttachmentEntityType, entityId: string): Promise<boolean> {
    const record = await loadAttachmentRecord(this.db, orgId, entityType, entityId);
    if (!record) return false;
    return (await recordAccess(this.db, { orgId, userId }, entityType, record)).canRead;
  }

  private async fieldMayRead(orgId: string, userId: string, owner: FileOwner): Promise<boolean> {
    switch (owner.type) {
      case "contact_logo":
      case "contact_person_photo":
      case "business_logo":
      case "user_avatar":
        return true;
      case "expense_receipt":
        return owner.submittedBy === userId;
      case "job_photo":
        return this.isAssigned(userId, [owner.id]);
      case "quote_pdf": {
        const [fromQuote, fromVariations] = await Promise.all([
          this.db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.sourceQuoteId, owner.id))),
          this.db.select({ id: jobVariationOrders.jobId }).from(jobVariationOrders).where(and(eq(jobVariationOrders.orgId, orgId), eq(jobVariationOrders.quoteId, owner.id))),
        ]);
        return this.isAssigned(userId, [...fromQuote, ...fromVariations].map((r) => r.id));
      }
      default:
        return false; // invoice, credit-note and receipt PDFs: money
    }
  }

  private async isAssigned(userId: string, jobIds: string[]): Promise<boolean> {
    if (!jobIds.length) return false;
    const [row] = await this.db
      .select({ id: jobAssignments.id })
      .from(jobAssignments)
      .where(and(eq(jobAssignments.userId, userId), inArray(jobAssignments.jobId, jobIds)))
      .limit(1);
    return Boolean(row);
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
  async download(file: FileRow, range?: ByteRange, asDownload = false): Promise<FileDownload> {
    const driver = this.readerFor(file);
    if (driver.presignedUrl) {
      if (file.integrityProblem) throw new ConflictException(DAMAGED_FILE_MESSAGE);
      const url = await driver.presignedUrl(file.key, MAX_FILE_LINK_SECONDS, {
        contentType: file.mimeType,
        contentDisposition: contentDisposition(file, asDownload),
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
    const [invoiceRows, quoteRows, creditNoteRows, paymentRows, expenseRows, photoRows, contactRows, personRows, signedQuoteRows] = await Promise.all([
      this.db.select({ id: invoices.issuedPdfFileId, number: invoices.number }).from(invoices).where(and(eq(invoices.orgId, orgId), inArray(invoices.issuedPdfFileId, ids))),
      this.db.select({ id: quotes.issuedPdfFileId, number: quotes.number }).from(quotes).where(and(eq(quotes.orgId, orgId), inArray(quotes.issuedPdfFileId, ids))),
      this.db.select({ id: creditNotes.issuedPdfFileId, number: creditNotes.number }).from(creditNotes).where(and(eq(creditNotes.orgId, orgId), inArray(creditNotes.issuedPdfFileId, ids))),
      this.db.select({ id: payments.issuedPdfFileId, number: payments.number }).from(payments).where(and(eq(payments.orgId, orgId), inArray(payments.issuedPdfFileId, ids))),
      this.db.select({ id: expenses.receiptFileId, number: expenses.number, description: expenses.description }).from(expenses).where(and(eq(expenses.orgId, orgId), inArray(expenses.receiptFileId, ids))),
      this.db.select({ id: jobPhotos.fileId, name: jobs.name }).from(jobPhotos).innerJoin(jobs, eq(jobPhotos.jobId, jobs.id)).where(and(eq(jobPhotos.orgId, orgId), inArray(jobPhotos.fileId, ids))),
      this.db.select({ id: contacts.logoFileId, name: contacts.name }).from(contacts).where(and(eq(contacts.orgId, orgId), inArray(contacts.logoFileId, ids))),
      this.db.select({ id: contactPersons.logoFileId, name: contactPersons.name }).from(contactPersons).where(inArray(contactPersons.logoFileId, ids)),
      this.db.select({ id: quotes.signatureFileId, number: quotes.number }).from(quotes).where(and(eq(quotes.orgId, orgId), inArray(quotes.signatureFileId, ids))),
    ]);
    for (const r of signedQuoteRows) set(r.id, `Customer's signature on quote ${r.number ?? ""}`.trim());
    for (const r of invoiceRows) set(r.id, `PDF of invoice ${r.number ?? "(draft)"}`);
    for (const r of quoteRows) set(r.id, `PDF of quote ${r.number ?? "(draft)"}`);
    for (const r of creditNoteRows) set(r.id, `PDF of credit note ${r.number ?? "(draft)"}`);
    for (const r of paymentRows) set(r.id, `Receipt PDF ${r.number ?? ""}`.trim());
    for (const r of expenseRows) set(r.id, `Receipt for expense ${[r.number, r.description].filter(Boolean).join(": ") || "(no description)"}`);
    for (const r of photoRows) set(r.id, `Photo on job: ${r.name}`);
    for (const r of contactRows) set(r.id, `Logo of ${r.name}`);
    for (const r of personRows) set(r.id, `Photo of ${r.name}`);
    const attached = await this.db
      .select({ id: attachments.fileId, entityType: attachments.entityType })
      .from(attachments)
      .where(and(eq(attachments.orgId, orgId), inArray(attachments.fileId, ids), isNull(attachments.removedAt)));
    for (const r of attached) if (r.id) set(r.id, `Attachment on a ${r.entityType.replace(/_/g, " ")}: ${labels.get(r.id)?.replace(/^File /, "") ?? ""}`.trim());
    const [profile] = await this.db
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.orgId, orgId), eq(settings.key, "business_profile")));
    const logoId = (profile?.value as { logoUrl?: string } | undefined)?.logoUrl?.match(/\/files\/([0-9a-f-]{36})/i)?.[1];
    set(logoId ?? null, "Business logo");
    const [layout] = await this.db
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.orgId, orgId), eq(settings.key, "document_layout")));
    set((layout?.value as { signatureFileId?: string | null } | undefined)?.signatureFileId ?? null, "Signature on documents");
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
