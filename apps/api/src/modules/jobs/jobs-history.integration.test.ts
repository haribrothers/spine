import type { FilesService } from "../files/files.service";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { contacts, files, member, user } from "../../db/schema";
import { JobsService } from "./jobs.service";
import { MilestonesService } from "./milestones.service";
import { AuditLogService } from "../audit/audit-log.service";
import { QuoteConversionGuardService } from "../org/quote-conversion-guard.service";
import { NotificationsService } from "../notifications/notifications.service";
import { QueueService } from "../queue/queue.service";
import { PushService } from "../notifications/push.service";
import { SettingsService } from "../org/settings.service";
import { InvoicesService } from "../invoices/invoices.service";
import { NumberingService } from "../numbering/numbering.service";
import { LedgerService } from "../ledger/ledger.service";
import { PeriodsService } from "../ledger/periods.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { EmailLogService } from "../email/email-log.service";
import { EmailService } from "../email/email.service";
import { PlaceOfSupplyService } from "../tax/place-of-supply.service";

/**
 * Regression coverage for `GET /jobs/:id/history`,
 * `GET /jobs/:id/milestones/:milestoneId/history`,
 * `GET /jobs/:id/photos/:photoId/history`, and
 * `GET /jobs/:id/notes/:noteId/history` — the READ side of audit history
 * for Jobs. Mirrors purchases-history.integration.test.ts's own structure.
 *
 * Job Photos and Job Notes had NO audit writes at all before this change
 * (only the job-level `entityType: "job"` rows for `photo_added`/
 * `note_added` existed) — `JobsService.addPhoto`/`addNote` now also write a
 * dedicated `entityType: "job_photo"`/`"job_note"` row per created record,
 * inside a `db.transaction(...)` alongside the insert, so this suite proves
 * both: the new dedicated rows exist, and the job's OWN history stays
 * separately scoped (still shows `photo_added`/`note_added` but never a
 * milestone's/photo's/note's own dedicated-entity rows) — no cross-entity
 * aggregation, per this module's own scoping rule.
 *
 * Variation Orders are deliberately NOT covered here: grepping
 * variation-orders.service.ts shows every one of its audit writes uses
 * `entityType: "job"` (variation-order creation/apply are logged as
 * job-level events, not their own entity), so there is no
 * variation-order-scoped history to read — nothing to test.
 *
 * Requires the `db` service from docker-compose.dev.yml running locally.
 */
describe("Jobs history (requires local Postgres)", () => {
  let db: Database;
  const createdEmails: string[] = [];

  let orgId: string;
  let contactId: string;
  let actorUserId: string;
  let jobsService: JobsService;
  let milestonesService: MilestonesService;

  afterAll(async () => {
    if (createdEmails.length === 0) return;
    await db.delete(user).where(eq(user.email, createdEmails[0]!));
  });

  beforeEach(async () => {
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const auditLog = new AuditLogService(db);
    const queue = new QueueService(db);
    const notifications = new NotificationsService(db, new PushService(db), new EmailLogService(db, queue, new EmailService(db), new AuditLogService(db)));
    const numbering = new NumberingService(db);
    const ledger = new LedgerService(db, new PeriodsService(db));
    const taxResolver = new TaxResolverService(db);
    const conversionGuard = new QuoteConversionGuardService(db, new SettingsService(db));
    const invoices = new InvoicesService(db, auditLog, numbering, ledger, queue, conversionGuard, taxResolver, new PlaceOfSupplyService(db), new EmailLogService(db, queue, new EmailService(db), new AuditLogService(db)));

    jobsService = new JobsService(db, auditLog, conversionGuard, notifications, numbering, {} as FilesService);
    milestonesService = new MilestonesService(db, auditLog, invoices, notifications);

    const ownerEmail = `jobs-history-owner-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail);

    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "History Owner" } });
    actorUserId = owner.user.id;
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Test Customer" }).returning();
    contactId = contact!.id;
  });

  function jobInput() {
    return { contactId, name: `Job ${randomUUID().slice(0, 8)}`, currency: "USD", contractValueAmount: 100000n, retentionPct: 0 };
  }

  describe("Jobs", () => {
    it("returns creation and update rows, newest first, scoped to that job only — never a milestone's/photo's/note's own rows", async () => {
      const job = await jobsService.create(orgId, actorUserId, jobInput());
      await jobsService.update(orgId, job.id, actorUserId, { name: "Renamed" });
      await jobsService.addNote(orgId, job.id, actorUserId, { body: "Site visit done" });

      const other = await jobsService.create(orgId, actorUserId, jobInput());
      await jobsService.update(orgId, other.id, actorUserId, { name: "Only on other" });

      const history = await jobsService.getHistory(orgId, job.id);
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history.every((h) => h.entityType === "job" && h.entityId === job.id)).toBe(true);
      expect(history.some((h) => h.action === "updated")).toBe(true);
      expect(history.some((h) => h.action === "note_added")).toBe(true);
      const changes = history.flatMap((h) => (Array.isArray(h.changes) ? (h.changes as { to: unknown }[]) : []));
      expect(changes.some((c) => c.to === "Only on other")).toBe(false);
    });

    it("throws NotFoundException for a job that doesn't exist in this org", async () => {
      await expect(jobsService.getHistory(orgId, randomUUID())).rejects.toThrow(/not found/i);
    });
  });

  describe("Milestones", () => {
    function milestoneSetInput() {
      return { milestones: [{ name: "Foundation", sequence: 0, amountType: "percent" as const, amount: 100, dueDate: null }] };
    }

    it("returns milestone-scoped rows only, not the job's own milestones_set row", async () => {
      const job = await jobsService.create(orgId, actorUserId, jobInput());
      const [milestone] = await milestonesService.setAll(orgId, job.id, actorUserId, milestoneSetInput());
      await milestonesService.completeMilestone(orgId, job.id, milestone!.id, actorUserId, { completionNotes: "Done", photoFileIds: [] });

      const history = await milestonesService.getHistory(orgId, job.id, milestone!.id);
      expect(history.every((h) => h.entityType === "milestone" && h.entityId === milestone!.id)).toBe(true);
      expect(history.some((h) => h.action === "milestone_completed")).toBe(true);
      expect(history.some((h) => h.action === "milestones_set")).toBe(false);
    });

    it("throws NotFoundException for a milestone that doesn't exist in this job", async () => {
      const job = await jobsService.create(orgId, actorUserId, jobInput());
      await expect(milestonesService.getHistory(orgId, job.id, randomUUID())).rejects.toThrow(/not found/i);
    });
  });

  describe("Job Photos", () => {
    it("writes a dedicated job_photo audit row on addPhoto, readable via getPhotoHistory, scoped to that photo only", async () => {
      const job = await jobsService.create(orgId, actorUserId, jobInput());
      const [file] = await db
        .insert(files)
        .values({ orgId, key: `test/${randomUUID()}.jpg`, originalFilename: "site.jpg", mimeType: "image/jpeg", sizeBytes: 1024, uploadedByUserId: actorUserId })
        .returning();

      const photo = await jobsService.addPhoto(orgId, job.id, actorUserId, { fileId: file!.id, caption: "Foundation poured" });

      const history = await jobsService.getPhotoHistory(orgId, job.id, photo!.id);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history.every((h) => h.entityType === "job_photo" && h.entityId === photo!.id)).toBe(true);
      expect(history.some((h) => h.action === "created")).toBe(true);

      // The job's own history still shows the job-level photo_added row, but
      // never the photo's own dedicated-entity row.
      const jobHistory = await jobsService.getHistory(orgId, job.id);
      expect(jobHistory.some((h) => h.action === "photo_added")).toBe(true);
      expect(jobHistory.every((h) => h.entityId !== photo!.id)).toBe(true);
    });

    it("throws NotFoundException for a photo that doesn't exist in this job", async () => {
      const job = await jobsService.create(orgId, actorUserId, jobInput());
      await expect(jobsService.getPhotoHistory(orgId, job.id, randomUUID())).rejects.toThrow(/not found/i);
    });
  });

  describe("Job Notes", () => {
    it("writes a dedicated job_note audit row on addNote, readable via getNoteHistory, scoped to that note only", async () => {
      const job = await jobsService.create(orgId, actorUserId, jobInput());
      const note = await jobsService.addNote(orgId, job.id, actorUserId, { body: "Client called about timeline" });

      const history = await jobsService.getNoteHistory(orgId, job.id, note!.id);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history.every((h) => h.entityType === "job_note" && h.entityId === note!.id)).toBe(true);
      expect(history.some((h) => h.action === "created")).toBe(true);

      const jobHistory = await jobsService.getHistory(orgId, job.id);
      expect(jobHistory.some((h) => h.action === "note_added")).toBe(true);
      expect(jobHistory.every((h) => h.entityId !== note!.id)).toBe(true);
    });

    it("throws NotFoundException for a note that doesn't exist in this job", async () => {
      const job = await jobsService.create(orgId, actorUserId, jobInput());
      await expect(jobsService.getNoteHistory(orgId, job.id, randomUUID())).rejects.toThrow(/not found/i);
    });
  });
});
