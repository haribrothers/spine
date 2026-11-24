import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Capability } from "@spine/shared";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { activities, contacts, leads, member, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { ContactsService } from "./contacts.service";
import { LeadsService } from "./leads.service";
import { LeadStagesService } from "./lead-stages.service";
import { ActivitiesService } from "./activities.service";
import { AuditLogService } from "../audit/audit-log.service";

/**
 * Regression coverage for PRD §9 S-01.16 — the "own vs others" capability
 * split extended to Leads and Activities, mirroring
 * contacts-catalog-ownership.integration.test.ts's own Contacts/Catalogue
 * coverage exactly. Leads and Activities use independent capability
 * families (`leads.*`/`activities.*`) — a Team's grants for one don't
 * affect the other, verified explicitly at the end of each describe block.
 *
 * Requires the `db` service from docker-compose.dev.yml running locally.
 */
describe("Leads/Activities ownership split (requires local Postgres)", () => {
  let db: Database;
  const createdEmails: string[] = [];

  let orgId: string;
  let contactId: string;
  let creatorUserId: string;
  let creatorMemberId: string;
  let otherUserId: string;
  let otherMemberId: string;
  let leadsService: LeadsService;
  let leadStagesService: LeadStagesService;
  let activitiesService: ActivitiesService;

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
    leadStagesService = new LeadStagesService(db, auditLog);
    leadsService = new LeadsService(db, auditLog, leadStagesService);
    activitiesService = new ActivitiesService(db, auditLog);

    const ownerEmail = `lead-act-owner-${randomUUID()}@example.com`;
    const creatorEmail = `lead-act-creator-${randomUUID()}@example.com`;
    const otherEmail = `lead-act-other-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail, creatorEmail, otherEmail);

    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "Ownership Owner" } });
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const [contact] = await db
      .insert(contacts)
      .values({ orgId, type: "customer", name: "Test Contact" })
      .returning();
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
  });

  describe("Leads", () => {
    it("creator with only edit_own can update their own lead but not another user's", async () => {
      await grantTeam(creatorMemberId, { "leads.edit_own": true });
      const lead = await leadsService.create(orgId, creatorUserId, { contactId, valueCurrency: "USD", title: "Own Lead" });

      await expect(leadsService.update(orgId, lead!.id, creatorUserId, { title: "Renamed by creator" })).resolves.toBeDefined();
      await expect(leadsService.update(orgId, lead!.id, otherUserId, { title: "Renamed by other" })).rejects.toThrow(/missing capability/i);
    });

    it("edit_others lets a different staff user edit a lead they didn't create", async () => {
      await grantTeam(creatorMemberId, { "leads.edit_own": true });
      const lead = await leadsService.create(orgId, creatorUserId, { contactId, valueCurrency: "USD", title: "Creator's Lead" });

      await grantTeam(otherMemberId, { "leads.edit_others": true });
      await expect(leadsService.update(orgId, lead!.id, otherUserId, { title: "Edited by other" })).resolves.toBeDefined();
    });

    it("delete_own vs delete_others are independent of edit_own/edit_others", async () => {
      await grantTeam(creatorMemberId, { "leads.edit_own": true });
      const lead = await leadsService.create(orgId, creatorUserId, { contactId, valueCurrency: "USD", title: "To Delete" });

      await grantTeam(otherMemberId, { "leads.edit_others": true });
      await expect(leadsService.delete(orgId, lead!.id, otherUserId)).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "leads.delete_others": true });
      await expect(leadsService.delete(orgId, lead!.id, otherUserId)).resolves.toBeDefined();
    });

    it("a legacy lead with no createdByUserId can only be touched via the _others capability, never _own", async () => {
      const [legacyLead] = await db
        .insert(leads)
        .values({ orgId, contactId, stageId: await leadStagesService.defaultStageId(orgId), valueCurrency: "USD", title: "Legacy Unowned Lead", createdByUserId: null })
        .returning();

      await grantTeam(creatorMemberId, { "leads.edit_own": true });
      await expect(leadsService.update(orgId, legacyLead!.id, creatorUserId, { title: "Attempted edit" })).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "leads.edit_others": true });
      await expect(leadsService.update(orgId, legacyLead!.id, otherUserId, { title: "Successful edit" })).resolves.toBeDefined();
    });

    it("Owner bypasses the ownership check entirely, regardless of Team grants", async () => {
      const lead = await leadsService.create(orgId, creatorUserId, { contactId, valueCurrency: "USD", title: "Any Lead" });
      const [ownerMembership] = await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.role, "owner")));
      await expect(leadsService.update(orgId, lead!.id, ownerMembership!.userId, { title: "Edited by owner" })).resolves.toBeDefined();
    });

    it("reassigning ownerUserId (the pipeline rep) does not change who the ownership check treats as creator", async () => {
      await grantTeam(creatorMemberId, { "leads.edit_own": true });
      const lead = await leadsService.create(orgId, creatorUserId, { contactId, valueCurrency: "USD", title: "Reassigned Lead" });

      // Reassign the pipeline owner to otherUserId — otherUserId still has
      // no grants, so they must NOT be able to edit it just by becoming the
      // assigned rep; createdByUserId (creatorUserId) is what "own" means.
      await leadsService.update(orgId, lead!.id, creatorUserId, { ownerUserId: otherUserId });
      await expect(leadsService.update(orgId, lead!.id, otherUserId, { title: "Should still fail" })).rejects.toThrow(/missing capability/i);
    });
  });

  describe("Activities", () => {
    it("creator with only edit_own can update their own activity but not another user's", async () => {
      await grantTeam(creatorMemberId, { "activities.edit_own": true });
      const activity = await activitiesService.create(orgId, creatorUserId, { contactId, type: "note", notes: "Own note" });

      await expect(activitiesService.update(orgId, activity!.id, creatorUserId, { notes: "Edited by creator" })).resolves.toBeDefined();
      await expect(activitiesService.update(orgId, activity!.id, otherUserId, { notes: "Edited by other" })).rejects.toThrow(/missing capability/i);
    });

    it("edit_others is required for markDone/markUndone on an activity the user didn't create", async () => {
      await grantTeam(creatorMemberId, { "activities.edit_own": true });
      const activity = await activitiesService.create(orgId, creatorUserId, { contactId, type: "task", notes: "Follow up" });

      await expect(activitiesService.markDone(orgId, activity!.id, otherUserId)).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "activities.edit_others": true });
      await expect(activitiesService.markDone(orgId, activity!.id, otherUserId)).resolves.toBeDefined();
      await expect(activitiesService.markUndone(orgId, activity!.id, otherUserId)).resolves.toBeDefined();
    });

    it("delete_own vs delete_others are independent of edit_own/edit_others", async () => {
      await grantTeam(creatorMemberId, { "activities.edit_own": true });
      const activity = await activitiesService.create(orgId, creatorUserId, { contactId, type: "call", notes: "To delete" });

      await grantTeam(otherMemberId, { "activities.edit_others": true });
      await expect(activitiesService.delete(orgId, activity!.id, otherUserId)).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "activities.delete_others": true });
      await expect(activitiesService.delete(orgId, activity!.id, otherUserId)).resolves.toBeDefined();
    });

    it("a legacy activity with no createdByUserId can only be touched via the _others capability", async () => {
      const [legacyActivity] = await db
        .insert(activities)
        .values({ orgId, contactId, type: "note", notes: "Legacy", createdByUserId: null })
        .returning();

      await grantTeam(creatorMemberId, { "activities.edit_own": true });
      await expect(activitiesService.update(orgId, legacyActivity!.id, creatorUserId, { notes: "Attempted edit" })).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "activities.edit_others": true });
      await expect(activitiesService.update(orgId, legacyActivity!.id, otherUserId, { notes: "Successful edit" })).resolves.toBeDefined();
    });

    it("reassigning assignedToUserId does not change who the ownership check treats as creator", async () => {
      await grantTeam(creatorMemberId, { "activities.edit_own": true });
      const activity = await activitiesService.create(orgId, creatorUserId, { contactId, type: "task", notes: "Assigned elsewhere", assignedToUserId: otherUserId });

      // otherUserId is the assignee, not the creator, and has no grants —
      // must still fail.
      await expect(activitiesService.markDone(orgId, activity!.id, otherUserId)).rejects.toThrow(/missing capability/i);
    });

    it("Leads and Activities grants are independent — having leads.edit_own does NOT grant activities.edit_own", async () => {
      const [ownerMembership] = await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.role, "owner")));
      const activity = await activitiesService.create(orgId, ownerMembership!.userId, { contactId, type: "note", notes: "Owner's note" });

      await grantTeam(creatorMemberId, { "leads.edit_own": true });
      await expect(activitiesService.update(orgId, activity!.id, creatorUserId, { notes: "Should not be allowed" })).rejects.toThrow(/missing capability/i);
    });
  });
});
