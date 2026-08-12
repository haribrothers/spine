import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { addJobNoteSchema, addJobPhotoSchema, createJobSchema, updateJobSchema } from "@spine/shared";
import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { jobs, contacts, quotes, jobPhotos, jobNotes } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { QuoteConversionGuardService } from "../org/quote-conversion-guard.service";
import { NotificationsService } from "../notifications/notifications.service";

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type AddJobNoteInput = z.infer<typeof addJobNoteSchema>;
export type AddJobPhotoInput = z.infer<typeof addJobPhotoSchema>;

/**
 * PRD F4 (Phase 3 · Jobs & Construction Billing) — job CRUD and the S-04.1
 * "create a job from an accepted quote" conversion. Milestones live in
 * their own MilestonesService (separate concern: a job's own fields vs. its
 * billing-schedule sub-resource), matching how Quotes/QuoteLines are two
 * services' worth of concerns split across one module in spirit, though
 * here they're genuinely two classes since milestones have their own
 * nontrivial validation (S-04.3) and later actions (S-04.4/S-04.5).
 */
@Injectable()
export class JobsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly conversionGuard: QuoteConversionGuardService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(orgId: string, options: { status?: string; contactId?: string }) {
    const conditions = [eq(jobs.orgId, orgId)];
    if (options.contactId) conditions.push(eq(jobs.contactId, options.contactId));
    if (options.status) conditions.push(eq(jobs.status, options.status as (typeof jobs.$inferSelect)["status"]));

    const rows = await this.db
      .select({ job: jobs, contactName: contacts.name })
      .from(jobs)
      .leftJoin(contacts, eq(jobs.contactId, contacts.id))
      .where(and(...conditions))
      .orderBy(desc(jobs.createdAt));

    return rows.map((r) => ({ ...r.job, contactName: r.contactName }));
  }

  async getOne(orgId: string, id: string) {
    const [row] = await this.db
      .select({ job: jobs, contactName: contacts.name })
      .from(jobs)
      .leftJoin(contacts, eq(jobs.contactId, contacts.id))
      .where(and(eq(jobs.orgId, orgId), eq(jobs.id, id)));
    if (!row) {
      throw new NotFoundException("Job not found");
    }
    return { ...row.job, contactName: row.contactName };
  }

  /** A job created directly, not from a quote — see this table's own PRD doc comment: S-04.1's own wording is specifically "from an accepted quote," so this path exists for completeness/flexibility (a job started without ever quoting, e.g. a handshake deal later formalised) rather than being the primary story path. */
  async create(orgId: string, actorUserId: string, input: CreateJobInput, isDemo = false, sourceQuoteId?: string) {
    const [contact] = await this.db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, input.contactId)));
    if (!contact) {
      throw new BadRequestException("Contact not found");
    }

    const created = await this.db.transaction(async (tx) => {
      const [job] = await tx
        .insert(jobs)
        .values({
          orgId,
          contactId: input.contactId,
          sourceQuoteId: sourceQuoteId ?? null,
          name: input.name,
          siteAddress: input.siteAddress ?? null,
          currency: input.currency,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
          contractValueAmount: input.contractValueAmount,
          retentionPct: input.retentionPct,
          notes: input.notes ?? null,
          createdByUserId: actorUserId,
          isDemo,
        })
        .returning();

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "job",
        entityId: job!.id,
        contactId: input.contactId,
        changes: [{ field: "status", from: null, to: "active" }],
      });

      return job;
    });

    return this.getOne(orgId, created!.id);
  }

  /**
   * S-04.1 / S-03.10's job half — "convert an accepted quote into a job
   * ... with the contract value carried over." Only an accepted quote is
   * convertible (mirrors InvoicesService.convertFromQuote's identical
   * guard and identical "no one-shot restriction" reasoning — a second job
   * could legitimately be raised off the same quote in principle, though
   * unlike invoices this is a much rarer real case). `contractValueAmount`
   * is the quote's own `totalAmount` snapshot, taken once here and never
   * re-read from the quote again — see jobs.ts's own doc comment.
   *
   * `QuoteConversionGuardService.check` guards against an ACCIDENTAL
   * repeat conversion (re-clicking the button) per the org's own
   * configurable warn/block preference — see that service's own doc
   * comment. It is not a one-shot restriction; a deliberate second
   * conversion still works once confirmed (or always, if the org has the
   * guard set to "off").
   */
  async createFromQuote(orgId: string, actorUserId: string, quoteId: string, retentionPct = 0, confirm = false) {
    const [quote] = await this.db.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, quoteId)));
    if (!quote) {
      throw new NotFoundException("Quote not found");
    }
    if (quote.status !== "accepted") {
      throw new BadRequestException("Only an accepted quote can be converted to a job");
    }

    await this.conversionGuard.check(orgId, quoteId, confirm);

    const input: CreateJobInput = {
      contactId: quote.contactId,
      name: quote.number ? `Job for ${quote.number}` : "New job",
      siteAddress: null,
      currency: quote.currency,
      startDate: null,
      endDate: null,
      contractValueAmount: quote.totalAmount,
      retentionPct,
      notes: quote.notes ?? null,
    };

    return this.create(orgId, actorUserId, input, false, quoteId);
  }

  async update(orgId: string, id: string, actorUserId: string, input: UpdateJobInput) {
    const [existing] = await this.db.select().from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.id, id)));
    if (!existing) {
      throw new NotFoundException("Job not found");
    }

    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(jobs)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.siteAddress !== undefined ? { siteAddress: input.siteAddress } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
          ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
          ...(input.retentionPct !== undefined ? { retentionPct: input.retentionPct } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, id))
        .returning();

      const changes = AuditLogService.diffFields(existing as unknown as Record<string, unknown>, input as Record<string, unknown>);
      if (changes.length) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "updated",
          entityType: "job",
          entityId: id,
          contactId: existing.contactId,
          changes,
        });
      }

      return row;
    });

    if (input.status === "completed" && existing.status !== "completed") {
      void this.notifications.notify(orgId, {
        subject: `Job completed — ${updated!.name}`,
        text: `Job "${updated!.name}" was marked completed.`,
        recipientRoles: ["owner", "staff"],
        inApp: {
          type: "job_completed",
          message: `Job "${updated!.name}" marked completed`,
          link: `/jobs/${updated!.id}`,
        },
      });
    }

    return this.getOne(orgId, updated!.id);
  }

  /** S-04.10 (web upload) — a general site/progress photo, not tied to a specific milestone's completion (that's MilestonesService.completeMilestone's own `photoFileIds`, which writes to this same `job_photos` table with `milestoneId` set). */
  async addPhoto(orgId: string, jobId: string, actorUserId: string, input: AddJobPhotoInput) {
    const job = await this.getOne(orgId, jobId);

    const [row] = await this.db
      .insert(jobPhotos)
      .values({ jobId, orgId, milestoneId: null, fileId: input.fileId, caption: input.caption ?? null, uploadedByUserId: actorUserId })
      .returning();

    await this.auditLog.record(this.db, {
      orgId,
      actorUserId,
      action: "photo_added",
      entityType: "job",
      entityId: jobId,
      contactId: job.contactId,
      changes: [{ field: "photoFileId", from: null, to: input.fileId }],
    });

    return row;
  }

  async listPhotos(orgId: string, jobId: string) {
    await this.getOne(orgId, jobId);
    return this.db.select().from(jobPhotos).where(eq(jobPhotos.jobId, jobId)).orderBy(desc(jobPhotos.createdAt));
  }

  async addNote(orgId: string, jobId: string, actorUserId: string, input: AddJobNoteInput) {
    const job = await this.getOne(orgId, jobId);

    const [row] = await this.db.insert(jobNotes).values({ jobId, orgId, body: input.body, createdByUserId: actorUserId }).returning();

    await this.auditLog.record(this.db, {
      orgId,
      actorUserId,
      action: "note_added",
      entityType: "job",
      entityId: jobId,
      contactId: job.contactId,
      changes: [{ field: "note", from: null, to: input.body }],
    });

    return row;
  }

  async listNotes(orgId: string, jobId: string) {
    await this.getOne(orgId, jobId);
    return this.db.select().from(jobNotes).where(eq(jobNotes.jobId, jobId)).orderBy(desc(jobNotes.createdAt));
  }
}
