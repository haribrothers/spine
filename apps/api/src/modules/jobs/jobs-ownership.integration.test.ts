import type { FilesService } from "../files/files.service";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Capability } from "@spine/shared";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { contacts, member, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
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
 * Regression coverage for the own/others capability split extended to Jobs
 * & Milestones (Phase 3): `jobs.edit_own`/`edit_others` gate job update;
 * `milestones.edit_own`/`edit_others` gate both defining the milestone set
 * (`setAll`) and marking a milestone complete, with Field always passing
 * BOTH branches for milestone completion (never an ownership question for
 * Field — see `FIELD_ALWAYS_CAPABILITIES`'s own doc comment). Workflow
 * actions (`milestones.invoice`, `jobs.release_retention`,
 * `variation_orders.apply`) and pure create-only capabilities
 * (`job_photos.edit_own`, `job_notes.edit_own`, `variation_orders.edit_own`)
 * are plain @RequireCapability route gates with no per-record ownership
 * check, so they're not covered here — same reasoning as
 * purchases-ownership.integration.test.ts's own scoping note.
 *
 * Requires the `db` service from docker-compose.dev.yml running locally.
 */
describe("Jobs & Milestones ownership split (requires local Postgres)", () => {
  let db: Database;
  const createdEmails: string[] = [];

  let orgId: string;
  let contactId: string;
  let creatorUserId: string;
  let creatorMemberId: string;
  let otherUserId: string;
  let otherMemberId: string;
  let fieldUserId: string;
  let jobsService: JobsService;
  let milestonesService: MilestonesService;

  afterAll(async () => {
    if (createdEmails.length === 0) return;
    await db.delete(user).where(inArray(user.email, createdEmails));
  });

  async function grantTeam(memberId: string, grants: Partial<Record<Capability, boolean>>) {
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
    const rows = Object.entries(grants).map(([capability, granted]) => ({
      teamId: team!.id,
      capability: capability as Capability,
      granted: granted ?? false,
    }));
    if (rows.length) {
      await db.insert(teamPrivileges).values(rows);
    }
    return team!.id;
  }

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

    const ownerEmail = `jobs-owner-${randomUUID()}@example.com`;
    const creatorEmail = `jobs-creator-${randomUUID()}@example.com`;
    const otherEmail = `jobs-other-${randomUUID()}@example.com`;
    const fieldEmail = `jobs-field-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail, creatorEmail, otherEmail, fieldEmail);

    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "Ownership Owner" } });
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Test Customer" }).returning();
    contactId = contact!.id;

    const creator = await auth.api.signUpEmail({ body: { email: creatorEmail, password: "testpassword123", name: "Ownership Creator" } });
    creatorUserId = creator.user.id;
    await db.delete(member).where(eq(member.userId, creator.user.id));
    const [creatorMember] = await db
      .insert(member)
      .values({ id: randomUUID(), organizationId: orgId, userId: creator.user.id, role: "staff", createdAt: new Date() })
      .returning();
    creatorMemberId = creatorMember!.id;

    const other = await auth.api.signUpEmail({ body: { email: otherEmail, password: "testpassword123", name: "Ownership Other" } });
    otherUserId = other.user.id;
    await db.delete(member).where(eq(member.userId, other.user.id));
    const [otherMember] = await db
      .insert(member)
      .values({ id: randomUUID(), organizationId: orgId, userId: other.user.id, role: "staff", createdAt: new Date() })
      .returning();
    otherMemberId = otherMember!.id;

    const field = await auth.api.signUpEmail({ body: { email: fieldEmail, password: "testpassword123", name: "Ownership Field" } });
    fieldUserId = field.user.id;
    await db.delete(member).where(eq(member.userId, field.user.id));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.user.id, role: "field", createdAt: new Date() });
  });

  function jobInput() {
    return { contactId, name: `Job ${randomUUID().slice(0, 8)}`, currency: "USD", contractValueAmount: 100000n, retentionPct: 0 };
  }

  describe("Jobs", () => {
    it("creator with only edit_own can update their own job but not another user's", async () => {
      await grantTeam(creatorMemberId, { "jobs.edit_own": true });
      const job = await jobsService.create(orgId, creatorUserId, jobInput());

      await expect(jobsService.update(orgId, job.id, creatorUserId, { name: "Renamed" })).resolves.toBeDefined();
      await expect(jobsService.update(orgId, job.id, otherUserId, { name: "Renamed by other" })).rejects.toThrow(/missing capability/i);
    });

    it("edit_others lets another Team member update a job they didn't create", async () => {
      const job = await jobsService.create(orgId, creatorUserId, jobInput());

      await grantTeam(otherMemberId, { "jobs.edit_own": true });
      await expect(jobsService.update(orgId, job.id, otherUserId, { name: "Should fail" })).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "jobs.edit_others": true });
      await expect(jobsService.update(orgId, job.id, otherUserId, { name: "Should succeed" })).resolves.toBeDefined();
    });

    it("Owner bypasses the ownership check entirely, regardless of Team grants", async () => {
      const job = await jobsService.create(orgId, creatorUserId, jobInput());
      const [ownerMembership] = await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.role, "owner")));
      await expect(jobsService.update(orgId, job.id, ownerMembership!.userId, { name: "Edited by owner" })).resolves.toBeDefined();
    });
  });

  describe("Milestones", () => {
    function milestoneSetInput() {
      return { milestones: [{ name: "Foundation", sequence: 0, amountType: "percent" as const, amount: 100, dueDate: null }] };
    }

    // US-JOB-20 (D-079): milestones are owned through the job, by its creator.
    it("the job's creator can define its first milestone set with edit_own; another user needs edit_others", async () => {
      const job = await jobsService.create(orgId, creatorUserId, jobInput());

      await grantTeam(creatorMemberId, { "milestones.edit_own": true });
      await expect(milestonesService.setAll(orgId, job.id, creatorUserId, milestoneSetInput())).resolves.toBeDefined();

      await grantTeam(otherMemberId, { "milestones.edit_own": true });
      await expect(milestonesService.setAll(orgId, job.id, otherUserId, milestoneSetInput())).rejects.toThrow(/missing capability/i);
    });

    it("edit_own lets the job's creator edit the set again, but not a different user", async () => {
      const job = await jobsService.create(orgId, creatorUserId, jobInput());

      await grantTeam(creatorMemberId, { "milestones.edit_own": true, "milestones.edit_others": true });
      await milestonesService.setAll(orgId, job.id, creatorUserId, milestoneSetInput());

      // The job's creator owns the set and can edit again with only edit_own.
      await expect(milestonesService.setAll(orgId, job.id, creatorUserId, milestoneSetInput())).resolves.toBeDefined();

      // A different Staff user with only edit_own cannot touch a set they don't own.
      await grantTeam(otherMemberId, { "milestones.edit_own": true });
      await expect(milestonesService.setAll(orgId, job.id, otherUserId, milestoneSetInput())).rejects.toThrow(/missing capability/i);
    });

    it("Field always passes both edit_own and edit_others when completing a milestone, even with zero Team grants", async () => {
      const job = await jobsService.create(orgId, creatorUserId, jobInput());
      await grantTeam(creatorMemberId, { "milestones.edit_own": true, "milestones.edit_others": true });
      const [milestone] = await milestonesService.setAll(orgId, job.id, creatorUserId, milestoneSetInput());

      // Field has zero Team memberships (Field never participates in the
      // Team matrix) — completing a milestone defined by someone else must
      // still succeed, since this was never meant to be an ownership
      // question for Field.
      await expect(
        milestonesService.completeMilestone(orgId, job.id, milestone!.id, fieldUserId, { completionNotes: null, photoFileIds: [] }),
      ).resolves.toBeDefined();
    });

    it("Staff with only edit_own cannot complete a milestone they didn't define", async () => {
      const job = await jobsService.create(orgId, creatorUserId, jobInput());
      await grantTeam(creatorMemberId, { "milestones.edit_own": true, "milestones.edit_others": true });
      const [milestone] = await milestonesService.setAll(orgId, job.id, creatorUserId, milestoneSetInput());

      await grantTeam(otherMemberId, { "milestones.edit_own": true });
      await expect(
        milestonesService.completeMilestone(orgId, job.id, milestone!.id, otherUserId, { completionNotes: null, photoFileIds: [] }),
      ).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "milestones.edit_others": true });
      await expect(
        milestonesService.completeMilestone(orgId, job.id, milestone!.id, otherUserId, { completionNotes: null, photoFileIds: [] }),
      ).resolves.toBeDefined();
    });
  });

  /**
   * Phase 5 (Mobile) — `jobs.assign` is a plain workflow-action capability,
   * not own/others-shaped (there's no "creator" of an assignment to split
   * by), so this covers the single-capability gate plus the idempotent
   * re-assign and unassign-then-reassign behavior JobsService.assign/
   * unassign rely on for a flaky mobile/office connection retrying safely.
   */
  describe("Crew assignment", () => {
    it("a Staff user with no jobs.assign grant cannot assign a crew member", async () => {
      const job = await jobsService.create(orgId, creatorUserId, jobInput());
      await expect(jobsService.assign(orgId, job.id, creatorUserId, { userId: fieldUserId })).rejects.toThrow(/missing capability/i);
    });

    it("jobs.assign lets a Staff user assign and unassign a crew member", async () => {
      const job = await jobsService.create(orgId, creatorUserId, jobInput());
      await grantTeam(creatorMemberId, { "jobs.assign": true });

      await expect(jobsService.assign(orgId, job.id, creatorUserId, { userId: fieldUserId })).resolves.toBeDefined();
      const assignees = await jobsService.listAssignees(orgId, job.id);
      expect(assignees.map((a) => a.userId)).toEqual([fieldUserId]);

      await expect(jobsService.unassign(orgId, job.id, creatorUserId, fieldUserId)).resolves.toEqual({ success: true });
      expect(await jobsService.listAssignees(orgId, job.id)).toEqual([]);
    });

    it("re-assigning an already-assigned user is idempotent, not a duplicate-key error", async () => {
      const job = await jobsService.create(orgId, creatorUserId, jobInput());
      await grantTeam(creatorMemberId, { "jobs.assign": true });

      await jobsService.assign(orgId, job.id, creatorUserId, { userId: fieldUserId });
      await expect(jobsService.assign(orgId, job.id, creatorUserId, { userId: fieldUserId })).resolves.toBeDefined();
      expect(await jobsService.listAssignees(orgId, job.id)).toHaveLength(1);
    });

    it("Owner bypasses jobs.assign entirely, regardless of Team grants", async () => {
      const job = await jobsService.create(orgId, creatorUserId, jobInput());
      const [ownerMembership] = await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.role, "owner")));
      await expect(jobsService.assign(orgId, job.id, ownerMembership!.userId, { userId: fieldUserId })).resolves.toBeDefined();
    });

    it("`assignedToUserId` filter on list() returns only jobs that user is assigned to", async () => {
      const assignedJob = await jobsService.create(orgId, creatorUserId, jobInput());
      const otherJob = await jobsService.create(orgId, creatorUserId, jobInput());
      await grantTeam(creatorMemberId, { "jobs.assign": true });
      await jobsService.assign(orgId, assignedJob.id, creatorUserId, { userId: fieldUserId });

      const rows = await jobsService.list(orgId, { assignedToUserId: fieldUserId });
      expect(rows.map((r) => r.id)).toEqual([assignedJob.id]);
      expect(rows.map((r) => r.id)).not.toContain(otherJob.id);
    });
  });
});
