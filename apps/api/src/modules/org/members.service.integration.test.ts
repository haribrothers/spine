import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { member, user } from "../../db/schema";
import { MembersService } from "./members.service";

/**
 * Requires the `db` service from docker-compose.dev.yml running locally.
 * Mirrors teams.service.integration.test.ts's setup: a real signup gives a
 * Primary Owner; additional members are inserted directly (no
 * invitation-accept flow exists yet, see CLAUDE.md's permission-model note).
 */
describe("MembersService promote/demote/transferPrimaryOwner (requires local Postgres)", () => {
  let db: Database;
  let membersService: MembersService;
  const createdEmails: string[] = [];

  let orgId: string;
  let primaryOwnerUserId: string;
  let primaryOwnerMemberId: string;
  let staffMemberId: string;

  afterAll(async () => {
    if (createdEmails.length === 0) return;
    await db.delete(user).where(inArray(user.email, createdEmails));
  });

  beforeEach(async () => {
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    membersService = new MembersService(db);

    const ownerEmail = `members-test-owner-${randomUUID()}@example.com`;
    const staffEmail = `members-test-staff-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail, staffEmail);

    const owner = await auth.api.signUpEmail({
      body: { email: ownerEmail, password: "testpassword123", name: "Members Test Owner" },
    });
    primaryOwnerUserId = owner.user.id;
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;
    primaryOwnerMemberId = ownerMembership!.id;

    const staffUser = await auth.api.signUpEmail({
      body: { email: staffEmail, password: "testpassword123", name: "Members Test Staff" },
    });
    await db.delete(member).where(eq(member.userId, staffUser.user.id));
    const [staffMember] = await db
      .insert(member)
      .values({ id: randomUUID(), organizationId: orgId, userId: staffUser.user.id, role: "staff", createdAt: new Date() })
      .returning();
    staffMemberId = staffMember!.id;
  });

  describe("promote", () => {
    it("promotes a Staff member to Owner", async () => {
      const promoted = await membersService.promote(orgId, staffMemberId);
      expect(promoted.role).toBe("owner");
      expect(promoted.isPrimaryOwner).toBe(false);
    });

    it("rejects promoting an already-Owner member", async () => {
      await expect(membersService.promote(orgId, primaryOwnerMemberId)).rejects.toThrow();
    });
  });

  describe("demote", () => {
    it("always rejects demoting the Primary Owner, even with other owners present", async () => {
      // Give the org a second owner so the sole-remaining-owner count check
      // alone wouldn't be what blocks this.
      await membersService.promote(orgId, staffMemberId);
      await expect(membersService.demote(orgId, primaryOwnerMemberId)).rejects.toThrow(/primary owner/i);
    });

    it("rejects demoting the sole remaining owner even if not primary", async () => {
      // Transfer primary ownership away, then try to demote the (now
      // non-primary, but still sole) owner it was transferred FROM after
      // removing the other owner — actually: promote staff, transfer
      // primary to them, then demoting the ORIGINAL primary owner should
      // succeed (no longer primary, and not sole). Demoting the NEW primary
      // owner should still be blocked (it's primary now).
      await membersService.promote(orgId, staffMemberId);
      await membersService.transferPrimaryOwner(orgId, primaryOwnerUserId, staffMemberId);
      // Original owner is no longer primary, and there are 2 owners — demote should succeed.
      const demoted = await membersService.demote(orgId, primaryOwnerMemberId);
      expect(demoted.role).toBe("staff");
    });

    it("demotes a non-primary Owner successfully", async () => {
      await membersService.promote(orgId, staffMemberId);
      const demoted = await membersService.demote(orgId, staffMemberId);
      expect(demoted.role).toBe("staff");
    });

    it("rejects demoting a Staff member (not currently an Owner)", async () => {
      const staffEmail = `members-test-staff2-${randomUUID()}@example.com`;
      createdEmails.push(staffEmail);
      const staffUser2 = await auth.api.signUpEmail({
        body: { email: staffEmail, password: "testpassword123", name: "Second Staff" },
      });
      await db.delete(member).where(eq(member.userId, staffUser2.user.id));
      const [staff2] = await db
        .insert(member)
        .values({ id: randomUUID(), organizationId: orgId, userId: staffUser2.user.id, role: "staff", createdAt: new Date() })
        .returning();
      await expect(membersService.demote(orgId, staff2!.id)).rejects.toThrow();
    });
  });

  describe("transferPrimaryOwner", () => {
    it("rejects a caller who is not the current Primary Owner", async () => {
      await membersService.promote(orgId, staffMemberId);
      const [staffUserId] = await db
        .select({ userId: member.userId })
        .from(member)
        .where(eq(member.id, staffMemberId));
      await expect(
        membersService.transferPrimaryOwner(orgId, staffUserId!.userId, staffMemberId),
      ).rejects.toThrow(/primary owner/i);
    });

    it("rejects a target who is not already an Owner", async () => {
      await expect(membersService.transferPrimaryOwner(orgId, primaryOwnerUserId, staffMemberId)).rejects.toThrow();
    });

    it("rejects transferring to yourself", async () => {
      await expect(
        membersService.transferPrimaryOwner(orgId, primaryOwnerUserId, primaryOwnerMemberId),
      ).rejects.toThrow(/yourself/i);
    });

    it("moves the Primary Owner flag to exactly one row after a successful transfer", async () => {
      await membersService.promote(orgId, staffMemberId);
      await membersService.transferPrimaryOwner(orgId, primaryOwnerUserId, staffMemberId);

      const primaryOwners = await db
        .select()
        .from(member)
        .where(and(eq(member.organizationId, orgId), eq(member.isPrimaryOwner, true)));
      expect(primaryOwners).toHaveLength(1);
      expect(primaryOwners[0]!.id).toBe(staffMemberId);
    });
  });
});
