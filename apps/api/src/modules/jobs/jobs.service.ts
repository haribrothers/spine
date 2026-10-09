import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { addJobNoteSchema, addJobPhotoSchema, assignJobSchema, createJobSchema, updateJobSchema } from "@spine/shared";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { jobs, jobVariationOrders, contacts, contactPersons, quotes, jobPhotos, jobNotes, jobAssignments, user, quoteLines, milestones } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { QuoteConversionGuardService } from "../org/quote-conversion-guard.service";
import { NotificationsService } from "../notifications/notifications.service";
import { hasCapability, requireOwnershipCapability } from "../../auth/capability.util";
import { NumberingService } from "../numbering/numbering.service";
import { jobNameFromQuote } from "./job-name";

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type AddJobNoteInput = z.infer<typeof addJobNoteSchema>;
export type AddJobPhotoInput = z.infer<typeof addJobPhotoSchema>;
export type AssignJobInput = z.infer<typeof assignJobSchema>;

/** The person the field crew calls about a job (US-MOB-05). */
export interface SiteContact {
  name: string;
  title: string | null;
  phone: string | null;
}

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
    private readonly numbering: NumberingService,
  ) {}

  /**
   * `assignedToUserId` (Phase 5, S-11.2) — "today's assigned jobs" on the
   * mobile home screen. Filters via an `INNER JOIN` on `job_assignments`
   * rather than a subquery, matching this method's existing join-based
   * shape for `contacts`; mirrors `ExpensesService.list`'s `mine`
   * query-param precedent (`purchases/expenses.controller.ts`) — same
   * "narrow to the requesting user" shape, applied here to job assignment
   * instead of expense submission.
   */
  /**
   * US-DASH-18 — each job's next pending milestone (earliest due date, then
   * board order), for `GET /jobs?include=next_milestone`.
   */
  async withNextMilestone<T extends { id: string }>(rows: T[]): Promise<(T & { nextMilestone: { id: string; name: string; dueDate: string | null } | null })[]> {
    if (rows.length === 0) return [];
    const pending = await this.db
      .select({ id: milestones.id, jobId: milestones.jobId, name: milestones.name, dueDate: milestones.dueDate })
      .from(milestones)
      .where(and(inArray(milestones.jobId, rows.map((r) => r.id)), eq(milestones.status, "pending")))
      .orderBy(sql`${milestones.dueDate} asc nulls last`, asc(milestones.sequence));
    const next = new Map<string, { id: string; name: string; dueDate: string | null }>();
    for (const m of pending) {
      if (!next.has(m.jobId)) next.set(m.jobId, { id: m.id, name: m.name, dueDate: m.dueDate ? m.dueDate.toISOString().slice(0, 10) : null });
    }
    return rows.map((r) => ({ ...r, nextMilestone: next.get(r.id) ?? null }));
  }

  /** US-MOB-04 — how many milestones each job has and how many are done, for "All milestones complete". */
  async withMilestoneCounts<T extends { id: string }>(rows: T[]): Promise<(T & { milestoneCounts: { total: number; completed: number } })[]> {
    if (rows.length === 0) return [];
    const counts = await this.db
      .select({ jobId: milestones.jobId, total: sql<number>`count(*)::int`, completed: sql<number>`count(*) filter (where ${milestones.status} <> 'pending')::int` })
      .from(milestones)
      .where(inArray(milestones.jobId, rows.map((r) => r.id)))
      .groupBy(milestones.jobId);
    const byJob = new Map(counts.map((c) => [c.jobId, { total: c.total, completed: c.completed }]));
    return rows.map((r) => ({ ...r, milestoneCounts: byJob.get(r.id) ?? { total: 0, completed: 0 } }));
  }

  /**
   * US-MOB-03, US-MOB-05 — who to call on site: the customer's primary
   * contact person (else their first), with the customer's own phone when
   * that person has none; for a customer with no people, the customer
   * itself. `phone` is null when nobody has a number.
   */
  async withSiteContact<T extends { contactId: string }>(rows: T[]): Promise<(T & { siteContact: SiteContact | null })[]> {
    if (rows.length === 0) return [];
    const contactIds = [...new Set(rows.map((r) => r.contactId))];
    const customers = await this.db.select({ id: contacts.id, name: contacts.name, phone: contacts.phone }).from(contacts).where(inArray(contacts.id, contactIds));
    const people = await this.db
      .select({ contactId: contactPersons.contactId, name: contactPersons.name, title: contactPersons.title, phone: contactPersons.phone })
      .from(contactPersons)
      .where(inArray(contactPersons.contactId, contactIds))
      .orderBy(desc(contactPersons.isPrimary), asc(contactPersons.createdAt));
    const byContact = new Map<string, SiteContact>();
    for (const customer of customers) {
      const person = people.find((p) => p.contactId === customer.id);
      byContact.set(
        customer.id,
        person
          ? { name: person.name, title: person.title ?? null, phone: person.phone || customer.phone || null }
          : { name: customer.name, title: null, phone: customer.phone || null },
      );
    }
    return rows.map((r) => ({ ...r, siteContact: byContact.get(r.contactId) ?? null }));
  }

  async list(orgId: string, options: { status?: string; contactId?: string; assignedToUserId?: string }) {
    const conditions = [eq(jobs.orgId, orgId)];
    if (options.contactId) conditions.push(eq(jobs.contactId, options.contactId));
    if (options.status) conditions.push(eq(jobs.status, options.status as (typeof jobs.$inferSelect)["status"]));

    if (options.assignedToUserId) {
      conditions.push(eq(jobAssignments.userId, options.assignedToUserId));
      const rows = await this.db
        .select({ job: jobs, contactName: contacts.name })
        .from(jobs)
        .innerJoin(jobAssignments, eq(jobAssignments.jobId, jobs.id))
        .leftJoin(contacts, eq(jobs.contactId, contacts.id))
        .where(and(...conditions))
        .orderBy(desc(jobs.createdAt));
      return rows.map((r) => ({ ...r.job, contactName: r.contactName }));
    }

    const rows = await this.db
      .select({ job: jobs, contactName: contacts.name })
      .from(jobs)
      .leftJoin(contacts, eq(jobs.contactId, contacts.id))
      .where(and(...conditions))
      .orderBy(desc(jobs.createdAt));

    return rows.map((r) => ({ ...r.job, contactName: r.contactName }));
  }

  /** US-MOB-05 (D-073) — `GET /jobs/:id/quotes`: variation-order quotes and the source quote, while `sent`, newest first, titled by their first line. */
  async quotesToPresent(orgId: string, jobId: string) {
    const job = await this.getOne(orgId, jobId);
    const variations = await this.db.select({ quoteId: jobVariationOrders.quoteId }).from(jobVariationOrders).where(and(eq(jobVariationOrders.orgId, orgId), eq(jobVariationOrders.jobId, jobId)));
    const variationIds = new Set(variations.map((v) => v.quoteId));
    const ids = [...variationIds, ...(job.sourceQuoteId ? [job.sourceQuoteId] : [])];
    if (ids.length === 0) return [];
    const rows = await this.db
      .select({ id: quotes.id, number: quotes.number, sentAt: quotes.sentAt, validUntil: quotes.validUntil })
      .from(quotes)
      .where(and(eq(quotes.orgId, orgId), inArray(quotes.id, ids), eq(quotes.status, "sent")))
      .orderBy(desc(quotes.sentAt));
    if (rows.length === 0) return [];
    const lines = await this.db
      .select({ quoteId: quoteLines.quoteId, name: quoteLines.name })
      .from(quoteLines)
      .where(inArray(quoteLines.quoteId, rows.map((r) => r.id)))
      .orderBy(asc(quoteLines.sortOrder));
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      kind: variationIds.has(r.id) ? ("variation" as const) : ("source" as const),
      title: lines.find((l) => l.quoteId === r.id)?.name ?? null,
      sentAt: r.sentAt,
      validUntil: r.validUntil ? r.validUntil.toISOString().slice(0, 10) : null,
    }));
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

  /** `GET /jobs/:id/history` — confirms the job exists (org-scoped) before delegating to AuditLogService, same pattern as InvoicesService.getHistory. Only rows with `entityType: "job"` — a job's own create/update/photo_added/note_added/milestones_set events, not its milestones'/notes'/photos' own dedicated history (see getHistory on MilestonesService and the job_note/job_photo history routes below), matching QuotesService.getHistory's "no cross-entity aggregation" precedent. */
  async getHistory(orgId: string, id: string) {
    await this.getOne(orgId, id);
    return this.auditLog.listForEntity(orgId, "job", id);
  }

  /** A job created directly, not from a quote — see this table's own PRD doc comment: S-04.1's own wording is specifically "from an accepted quote," so this path exists for completeness/flexibility (a job started without ever quoting, e.g. a handshake deal later formalised) rather than being the primary story path. */
  async create(orgId: string, actorUserId: string, input: CreateJobInput, isDemo = false, sourceQuoteId?: string) {
    const [contact] = await this.db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, input.contactId)));
    if (!contact) {
      throw new BadRequestException("Contact not found");
    }

    const created = await this.db.transaction(async (tx) => {
      // US-JOB-22: the next Job number, under the sequence row lock.
      // US-ONB-17: a job for a demo customer is demo too, in the demo series.
      const number = await this.numbering.allocateNumber(tx, orgId, "job", { demo: isDemo || contact.isDemo });
      const [job] = await tx
        .insert(jobs)
        .values({
          orgId,
          number,
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

    // US-JOB-23: named after the quote's first item and the customer.
    const [firstItem] = await this.db
      .select({ name: quoteLines.name })
      .from(quoteLines)
      .where(and(eq(quoteLines.quoteId, quoteId), eq(quoteLines.type, "item")))
      .orderBy(asc(quoteLines.sortOrder))
      .limit(1);
    const [customer] = await this.db.select({ name: contacts.name }).from(contacts).where(eq(contacts.id, quote.contactId));
    const [{ count: earlier } = { count: 0 }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(and(eq(jobs.orgId, orgId), eq(jobs.sourceQuoteId, quoteId)));

    const input: CreateJobInput = {
      contactId: quote.contactId,
      name: jobNameFromQuote(firstItem?.name, customer?.name, earlier + 1),
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

    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "jobs.edit_own",
      others: "jobs.edit_others",
    });

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
          ...(input.costBudgetAmount !== undefined ? { costBudgetAmount: input.costBudgetAmount } : {}),
          ...(input.percentComplete !== undefined ? { percentComplete: input.percentComplete } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, id))
        .returning();

      // Money compared and recorded as strings (US-JOB-24's budget is a bigint).
      const asText = (v: unknown) => (typeof v === "bigint" ? v.toString() : v);
      const changes = AuditLogService.diffFields(
        { ...existing, costBudgetAmount: asText(existing.costBudgetAmount) } as unknown as Record<string, unknown>,
        { ...input, ...(input.costBudgetAmount !== undefined ? { costBudgetAmount: asText(input.costBudgetAmount) } : {}) } as Record<string, unknown>,
      ).filter((c) => !(c.field === "costBudgetAmount" && c.from === null && c.to === null));
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

  /**
   * S-04.10 (web upload) — a general site/progress photo, not tied to a
   * specific milestone's completion (that's MilestonesService.
   * completeMilestone's own `photoFileIds`, which writes to this same
   * `job_photos` table with `milestoneId` set). Wrapped in `db.transaction`
   * so the insert and both audit writes are atomic, per AuditLogService's
   * own top comment. Writes TWO audit rows: the pre-existing job-level
   * `entityType: "job", action: "photo_added"` row (kept as-is — it's the
   * job's own activity feed entry, read by `getHistory` above) plus a new
   * `entityType: "job_photo", entityId: <photo id>` row so the photo gets
   * its own dedicated single-row history (see getPhotoHistory below).
   */
  async addPhoto(orgId: string, jobId: string, actorUserId: string, input: AddJobPhotoInput) {
    const job = await this.getOne(orgId, jobId);
    if (input.milestoneId) {
      const [milestone] = await this.db.select({ id: milestones.id }).from(milestones).where(and(eq(milestones.id, input.milestoneId), eq(milestones.jobId, jobId)));
      if (!milestone) throw new BadRequestException("Choose one of this job's milestones.");
    }

    const row = await this.db.transaction(async (tx) => {
      const [photo] = await tx
        .insert(jobPhotos)
        .values({
          jobId,
          orgId,
          milestoneId: input.milestoneId ?? null,
          fileId: input.fileId,
          caption: input.caption ?? null,
          uploadedByUserId: actorUserId,
          createdByUserId: actorUserId,
        })
        .returning();

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "photo_added",
        entityType: "job",
        entityId: jobId,
        contactId: job.contactId,
        changes: [{ field: "photoFileId", from: null, to: input.fileId }],
      });

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "job_photo",
        entityId: photo!.id,
        contactId: job.contactId,
        changes: null,
      });

      return photo;
    });

    return row;
  }

  async listPhotos(orgId: string, jobId: string) {
    await this.getOne(orgId, jobId);
    return this.db.select().from(jobPhotos).where(eq(jobPhotos.jobId, jobId)).orderBy(desc(jobPhotos.createdAt));
  }

  /** `GET /jobs/:id/photos/:photoId/history` — confirms the photo exists (org- and job-scoped) before delegating to AuditLogService. Create-only resource, so this will show a single "created" row — still built for consistency with every other resource's History button. */
  async getPhotoHistory(orgId: string, jobId: string, photoId: string) {
    const [row] = await this.db
      .select()
      .from(jobPhotos)
      .where(and(eq(jobPhotos.orgId, orgId), eq(jobPhotos.jobId, jobId), eq(jobPhotos.id, photoId)));
    if (!row) {
      throw new NotFoundException("Job photo not found");
    }
    return this.auditLog.listForEntity(orgId, "job_photo", photoId);
  }

  /**
   * Wrapped in `db.transaction` for the same reason as addPhoto above.
   * Writes both the pre-existing job-level `entityType: "job"` row (kept,
   * feeds `getHistory` above) and a new `entityType: "job_note"` row scoped
   * to just this note.
   */
  async addNote(orgId: string, jobId: string, actorUserId: string, input: AddJobNoteInput) {
    const job = await this.getOne(orgId, jobId);

    const row = await this.db.transaction(async (tx) => {
      const [note] = await tx.insert(jobNotes).values({ jobId, orgId, body: input.body, createdByUserId: actorUserId }).returning();

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "note_added",
        entityType: "job",
        entityId: jobId,
        contactId: job.contactId,
        changes: [{ field: "note", from: null, to: input.body }],
      });

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "job_note",
        entityId: note!.id,
        contactId: job.contactId,
        changes: null,
      });

      return note;
    });

    return row;
  }

  async listNotes(orgId: string, jobId: string) {
    await this.getOne(orgId, jobId);
    return this.db.select().from(jobNotes).where(eq(jobNotes.jobId, jobId)).orderBy(desc(jobNotes.createdAt));
  }

  /** `GET /jobs/:id/notes/:noteId/history` — same shape as getPhotoHistory above. */
  async getNoteHistory(orgId: string, jobId: string, noteId: string) {
    const [row] = await this.db
      .select()
      .from(jobNotes)
      .where(and(eq(jobNotes.orgId, orgId), eq(jobNotes.jobId, jobId), eq(jobNotes.id, noteId)));
    if (!row) {
      throw new NotFoundException("Job note not found");
    }
    return this.auditLog.listForEntity(orgId, "job_note", noteId);
  }

  /** Phase 5 (Mobile) — who's on a job's crew. Any authenticated org member can read, same as every other GET on this controller. */
  async listAssignees(orgId: string, jobId: string) {
    await this.getOne(orgId, jobId);
    const rows = await this.db
      .select({ id: jobAssignments.id, userId: jobAssignments.userId, assignedAt: jobAssignments.assignedAt, name: user.name, email: user.email })
      .from(jobAssignments)
      .innerJoin(user, eq(jobAssignments.userId, user.id))
      .where(and(eq(jobAssignments.orgId, orgId), eq(jobAssignments.jobId, jobId)))
      .orderBy(desc(jobAssignments.assignedAt));
    return rows;
  }

  /**
   * `jobs.assign` — a dedicated workflow-action capability (see
   * permissions.ts's own doc comment), not part of `jobs.edit_own`/
   * `edit_others`. `actorUserId` isn't checked against the job's
   * `createdByUserId` here (own/others doesn't apply — "who can decide the
   * crew" isn't an ownership question), matching `jobs.release_retention`/
   * `variation_orders.apply`'s identical shape. Idempotent: re-assigning an
   * already-assigned user is a no-op (the unique index on
   * `(jobId, userId)` would otherwise throw), matching how this action
   * would naturally be retried from a flaky office connection.
   */
  async assign(orgId: string, jobId: string, actorUserId: string, input: AssignJobInput) {
    const granted = await hasCapability(this.db, { orgId, userId: actorUserId }, "jobs.assign");
    if (!granted) {
      throw new ForbiddenException("Missing capability: jobs.assign");
    }

    const job = await this.getOne(orgId, jobId);

    const [targetMember] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, input.userId));
    if (!targetMember) {
      throw new BadRequestException("User not found");
    }

    const [existing] = await this.db
      .select({ id: jobAssignments.id })
      .from(jobAssignments)
      .where(and(eq(jobAssignments.jobId, jobId), eq(jobAssignments.userId, input.userId)));
    if (existing) {
      return existing;
    }

    const row = await this.db.transaction(async (tx) => {
      const [assignment] = await tx
        .insert(jobAssignments)
        .values({ jobId, orgId, userId: input.userId })
        .returning();

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "assigned",
        entityType: "job",
        entityId: jobId,
        contactId: job.contactId,
        changes: [{ field: "assignedUserId", from: null, to: input.userId }],
      });

      return assignment;
    });

    await this.notifyCrewChange(orgId, actorUserId, input.userId, job, "added");
    return row;
  }

  async unassign(orgId: string, jobId: string, actorUserId: string, targetUserId: string) {
    const granted = await hasCapability(this.db, { orgId, userId: actorUserId }, "jobs.assign");
    if (!granted) {
      throw new ForbiddenException("Missing capability: jobs.assign");
    }

    const job = await this.getOne(orgId, jobId);

    const [existing] = await this.db
      .select({ id: jobAssignments.id })
      .from(jobAssignments)
      .where(and(eq(jobAssignments.jobId, jobId), eq(jobAssignments.userId, targetUserId)));
    if (!existing) {
      throw new NotFoundException("Job assignment not found");
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(jobAssignments).where(eq(jobAssignments.id, existing.id));

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "unassigned",
        entityType: "job",
        entityId: jobId,
        contactId: job.contactId,
        changes: [{ field: "assignedUserId", from: targetUserId, to: null }],
      });
    });

    await this.notifyCrewChange(orgId, actorUserId, targetUserId, job, "removed");
    return { success: true };
  }

  /**
   * US-MOB-22 — tells a person they were put on (`crew_assigned`) or taken
   * off (`crew_removed`) a job's crew, unless they did it themselves. A
   * removal has no link: the job is no longer theirs to open.
   */
  private async notifyCrewChange(orgId: string, actorUserId: string, targetUserId: string, job: { id: string; name: string; siteAddress: string | null }, change: "added" | "removed") {
    if (targetUserId === actorUserId) return;
    const [actor] = await this.db.select({ name: user.name }).from(user).where(eq(user.id, actorUserId));
    const who = actor?.name || "Your office";
    const message = change === "added" ? `You're on the crew for ${job.name}` : `You're off the crew for ${job.name}`;
    const detail = change === "added" ? [`Added by ${who}`, ...(job.siteAddress ? [job.siteAddress.replace(/\s*\n\s*/g, ", ")] : [])].join(" · ") : `Removed by ${who}`;
    await this.notifications.notify(orgId, {
      subject: message,
      text: `${message}. ${detail}.`,
      recipientUserIds: [targetUserId],
      inApp: { type: change === "added" ? "crew_assigned" : "crew_removed", message, detail, link: change === "added" ? `/jobs/${job.id}` : undefined },
    });
  }
}
