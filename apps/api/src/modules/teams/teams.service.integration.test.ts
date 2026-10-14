import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { member, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { TeamsService } from "./teams.service";

/**
 * Requires the `db` service from docker-compose.dev.yml running locally.
 * Each org is a fresh real signup (via auth.api.signUpEmail, same as
 * signup.integration.test.ts) so a Primary Owner and a "General Staff"
 * default team already exist per Phase A's seeding — no invitation-accept
 * flow exists yet (see CLAUDE.md's permission-model note), so additional
 * Staff members are inserted directly via Drizzle to simulate one.
 */
describe("TeamsService (requires local Postgres)", () => {
  let db: Database;
  let teamsService: TeamsService;
  const createdEmails: string[] = [];

  let orgId: string;
  let defaultTeamId: string;
  let staffMemberId: string;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine";
    db = createDb(databaseUrl);
    teamsService = new TeamsService(db, new AuditLogService(db));
  });

  afterAll(async () => {
    if (createdEmails.length === 0) return;
    await db.delete(user).where(inArray(user.email, createdEmails));
  });

  beforeEach(async () => {
    const ownerEmail = `teams-test-owner-${randomUUID()}@example.com`;
    const staffEmail = `teams-test-staff-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail, staffEmail);

    const owner = await auth.api.signUpEmail({
      body: { email: ownerEmail, password: "testpassword123", name: "Teams Test Owner" },
    });
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const [defaultTeam] = await db.select().from(teams).where(and(eq(teams.orgId, orgId), eq(teams.isDefault, true)));
    defaultTeamId = defaultTeam!.id;

    // Simulate an accepted Staff invite — no real accept-invitation flow
    // exists yet, so insert the member row directly.
    const staffUser = await auth.api.signUpEmail({
      body: { email: staffEmail, password: "testpassword123", name: "Teams Test Staff" },
    });
    // signUpEmail always creates its own brand-new org (per auth.ts's
    // signup hook) — delete that org's member row and re-insert this user
    // as a Staff member of the org under test instead.
    await db.delete(member).where(eq(member.userId, staffUser.user.id));
    const [staffMember] = await db
      .insert(member)
      .values({
        id: randomUUID(),
        organizationId: orgId,
        userId: staffUser.user.id,
        role: "staff",
        createdAt: new Date(),
      })
      .returning();
    staffMemberId = staffMember!.id;
  });

  describe("create/list", () => {
    it("creates a team and lists it with a zero member count", async () => {
      const created = await teamsService.create(orgId, "Site Crew");
      expect(created.name).toBe("Site Crew");
      expect(created.isDefault).toBe(false);
      expect(created.memberCount).toBe(0);

      const list = await teamsService.list(orgId);
      expect(list.some((t) => t.id === created.id)).toBe(true);
    });
  });

  describe("delete", () => {
    it("rejects deleting the default team", async () => {
      await expect(teamsService.delete(orgId, defaultTeamId)).rejects.toThrow(/default team/i);
    });

    it("rejects deleting an org's only team", async () => {
      // The default team is currently the org's only team.
      const list = await teamsService.list(orgId);
      expect(list).toHaveLength(1);
      await expect(teamsService.delete(orgId, defaultTeamId)).rejects.toThrow();
    });

    it("allows deleting a non-default team when another team still exists", async () => {
      const extra = await teamsService.create(orgId, "Temp Team");
      await teamsService.delete(orgId, extra.id);
      const list = await teamsService.list(orgId);
      expect(list.some((t) => t.id === extra.id)).toBe(false);
    });
  });

  describe("setPrivileges", () => {
    it("upserts privileges without creating duplicate rows on repeat calls", async () => {
      const team = await teamsService.create(orgId, "Privilege Test Team");

      await teamsService.setPrivileges(orgId, team.id, [{ capability: "ledger.view", granted: true }]);
      await teamsService.setPrivileges(orgId, team.id, [{ capability: "ledger.view", granted: false }]);

      const rows = await db
        .select()
        .from(teamPrivileges)
        .where(and(eq(teamPrivileges.teamId, team.id), eq(teamPrivileges.capability, "ledger.view")));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.granted).toBe(false);
    });

    it("returns the full capability set with unset rows defaulting to false", async () => {
      const team = await teamsService.create(orgId, "Sparse Team");
      const result = await teamsService.setPrivileges(orgId, team.id, [{ capability: "quotes.edit_own", granted: true }]);
      expect(result["quotes.edit_own"]).toBe(true);
      expect(result["ledger.view"]).toBe(false);
    });
  });

  describe("setMembers", () => {
    it("rejects a memberId from another org", async () => {
      const otherOwnerEmail = `teams-test-other-${randomUUID()}@example.com`;
      createdEmails.push(otherOwnerEmail);
      const otherOwner = await auth.api.signUpEmail({
        body: { email: otherOwnerEmail, password: "testpassword123", name: "Other Org Owner" },
      });
      const [otherMembership] = await db.select().from(member).where(eq(member.userId, otherOwner.user.id));

      await expect(teamsService.setMembers(orgId, defaultTeamId, [otherMembership!.id])).rejects.toThrow(
        /invalid|not in this org/i,
      );
    });

    it("rejects a non-Staff memberId (e.g. an Owner)", async () => {
      const [ownerMember] = await db
        .select()
        .from(member)
        .where(and(eq(member.organizationId, orgId), eq(member.role, "owner")));
      await expect(teamsService.setMembers(orgId, defaultTeamId, [ownerMember!.id])).rejects.toThrow();
    });

    it("full-replaces team membership", async () => {
      const team = await teamsService.create(orgId, "Membership Test Team");
      await teamsService.setMembers(orgId, team.id, [staffMemberId]);

      let rows = await db.select().from(teamMemberships).where(eq(teamMemberships.teamId, team.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.memberId).toBe(staffMemberId);

      await teamsService.setMembers(orgId, team.id, []);
      rows = await db.select().from(teamMemberships).where(eq(teamMemberships.teamId, team.id));
      expect(rows).toHaveLength(0);
    });
  });

  describe("getDetail", () => {
    it("reflects assigned members and the full privilege matrix", async () => {
      await teamsService.setMembers(orgId, defaultTeamId, [staffMemberId]);
      const detail = await teamsService.getDetail(orgId, defaultTeamId);
      expect(detail.members.some((m) => m.memberId === staffMemberId)).toBe(true);
      expect(Object.keys(detail.privileges).length).toBeGreaterThan(0);
    });
  });
});
