import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { MAX_ATTACHMENTS_PER_RECORD, TOO_MANY_ATTACHMENTS, type Attachment, type AttachmentEntityType, type AttachmentList, type CreateAttachmentInput } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { attachments, files, user } from "../../db/schema";
import { AuditLogService, type AuditEntityType } from "../audit/audit-log.service";
import { FilesService } from "../files/files.service";
import { loadAttachmentRecord, recordAccess, type AttachmentRecord } from "./attachment-records";

const RECORD_NOT_FOUND = "Record not found";

/** How many live attachments each record has, for the paperclip on list views (US-OPS-33). */
export async function attachmentCounts(db: Database, orgId: string, entityType: AttachmentEntityType, ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({ entityId: attachments.entityId, count: count() })
    .from(attachments)
    .where(and(eq(attachments.orgId, orgId), eq(attachments.entityType, entityType), inArray(attachments.entityId, ids), isNull(attachments.removedAt)))
    .groupBy(attachments.entityId);
  return new Map(rows.map((r) => [r.entityId, Number(r.count)]));
}

/**
 * US-OPS-33 (D-156) — files kept with a record. Reading follows the
 * record's read rule, adding its edit rule; at most 10 live files a record.
 */
@Injectable()
export class AttachmentsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly files: FilesService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(orgId: string, userId: string, entityType: AttachmentEntityType, entityId: string): Promise<AttachmentList> {
    const { record, access } = await this.readable(orgId, userId, entityType, entityId);
    const rows = await this.db
      .select({ attachment: attachments, file: files, creatorName: user.name })
      .from(attachments)
      .innerJoin(files, eq(files.id, attachments.fileId))
      .leftJoin(user, eq(user.id, attachments.createdByUserId))
      .where(and(eq(attachments.orgId, orgId), eq(attachments.entityType, entityType), eq(attachments.entityId, entityId), isNull(attachments.removedAt)))
      .orderBy(asc(attachments.createdAt));
    return {
      attachments: rows.map((r) => this.toResponse(r.attachment, r.file, r.creatorName)),
      canAdd: access.canEdit,
      canRemove: access.canEdit && !record.locked,
      canRemoveWithReason: access.role === "owner" && record.locked,
      locked: record.locked,
    };
  }

  async add(orgId: string, userId: string, input: CreateAttachmentInput): Promise<Attachment> {
    const { record, access } = await this.readable(orgId, userId, input.entityType, input.entityId);
    if (!access.canEdit) throw new ForbiddenException("You don't have permission to add files to this record.");
    const file = await this.files.getMetadata(orgId, input.fileId);
    // Only a file this person just uploaded, so nobody can pull someone else's file onto a record.
    if (file.uploadedByUserId !== userId) throw new BadRequestException("Upload the file first.");

    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`attachments:${input.entityType}:${input.entityId}`}))`);
      const [used] = await tx.select({ id: attachments.id }).from(attachments).where(and(eq(attachments.fileId, file.id), isNull(attachments.removedAt))).limit(1);
      if (used) throw new BadRequestException("This file is already attached. Upload it again to attach it somewhere else.");
      const [{ live }] = (await tx
        .select({ live: count() })
        .from(attachments)
        .where(and(eq(attachments.orgId, orgId), eq(attachments.entityType, input.entityType), eq(attachments.entityId, input.entityId), isNull(attachments.removedAt)))) as [{ live: number }];
      if (Number(live) >= MAX_ATTACHMENTS_PER_RECORD) throw new BadRequestException(TOO_MANY_ATTACHMENTS);

      const [row] = await tx.insert(attachments).values({ orgId, entityType: input.entityType, entityId: input.entityId, fileId: file.id, createdByUserId: userId }).returning();
      await this.auditLog.record(tx, {
        orgId,
        actorUserId: userId,
        action: "attachment_added",
        entityType: input.entityType as AuditEntityType,
        entityId: input.entityId,
        contactId: record.contactId,
        changes: [{ field: "attachment", from: null, to: file.originalFilename }],
      });
      const [creator] = await tx.select({ name: user.name }).from(user).where(eq(user.id, userId));
      return this.toResponse(row!, file, creator?.name ?? null);
    });
  }

  /** The record, if this person may read it; anyone else gets a 404, as if it didn't exist. */
  private async readable(orgId: string, userId: string, entityType: AttachmentEntityType, entityId: string) {
    const record: AttachmentRecord | null = await loadAttachmentRecord(this.db, orgId, entityType, entityId);
    if (!record) throw new NotFoundException(RECORD_NOT_FOUND);
    const access = await recordAccess(this.db, { orgId, userId }, entityType, record);
    if (!access.canRead) throw new NotFoundException(RECORD_NOT_FOUND);
    return { record, access };
  }

  private toResponse(row: typeof attachments.$inferSelect, file: typeof files.$inferSelect, creatorName: string | null): Attachment {
    return {
      id: row.id,
      file: { id: file.id, name: file.originalFilename, size: Number(file.sizeBytes), contentType: file.mimeType },
      createdBy: row.createdByUserId ? { id: row.createdByUserId, name: creatorName ?? "Former member" } : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
