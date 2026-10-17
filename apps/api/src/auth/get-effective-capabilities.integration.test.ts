import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { CAPABILITIES } from "@spine/shared";
import { auth } from "./auth";
import { FIELD_ALWAYS_CAPABILITIES, FIELD_OWN_CAPABILITIES, getEffectiveCapabilities } from "./capability.util";
import { createDb, type Database } from "../db/client";
import { member, teamMemberships, teamPrivileges, teams, user } from "../db/schema";

/**
 * Regression coverage for `getEffectiveCapabilities`, which backs
 * `GET /org/members/me/capabilities` — the web privilege-aware UI's one
 * source of truth for which buttons/actions to show. Each test cleans up
 * its own users inline rather than an `afterAll` batch, since every test
 * creates a fresh org. Requires the `db` service from
 * docker-compose.dev.yml running locally.
 */
describe("getEffectiveCapabilities (requires local Postgres)", () => {
  let db: Database;
  let orgId: string;

  beforeEach(async () => {
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  });

  it("Owner gets every capability true", async () => {
    const email = `caps-owner-${randomUUID()}@example.com`;
    const owner = await auth.api.signUpEmail({ body: { email, password: "testpassword123", name: "Caps Owner" } });
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const result = await getEffectiveCapabilities(db, { orgId, userId: owner.user.id });
    for (const capability of CAPABILITIES) {
      // US-AI-05: the AI assistant starts off, so its right reads false until it's switched on (US-SET-24).
      expect(result[capability], capability).toBe(capability !== "ai.use");
    }

    await db.delete(user).where(eq(user.id, owner.user.id));
  });

  it("Field gets true only for FIELD_OWN_CAPABILITIES and FIELD_ALWAYS_CAPABILITIES, false for everything else", async () => {
    const ownerEmail = `caps-field-owner-${randomUUID()}@example.com`;
    const fieldEmail = `caps-field-${randomUUID()}@example.com`;
    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "Owner" } });
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const field = await auth.api.signUpEmail({ body: { email: fieldEmail, password: "testpassword123", name: "Field" } });
    await db.delete(member).where(eq(member.userId, field.user.id));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.user.id, role: "field", createdAt: new Date() });

    const result = await getEffectiveCapabilities(db, { orgId, userId: field.user.id });
    for (const capability of CAPABILITIES) {
      expect(result[capability]).toBe(FIELD_OWN_CAPABILITIES.has(capability) || FIELD_ALWAYS_CAPABILITIES.has(capability));
    }

    await db.delete(user).where(eq(user.id, owner.user.id));
    await db.delete(user).where(eq(user.id, field.user.id));
  });

  it("Staff gets the union of grants across all their Teams", async () => {
    const ownerEmail = `caps-staff-owner-${randomUUID()}@example.com`;
    const staffEmail = `caps-staff-${randomUUID()}@example.com`;
    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "Owner" } });
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const staff = await auth.api.signUpEmail({ body: { email: staffEmail, password: "testpassword123", name: "Staff" } });
    await db.delete(member).where(eq(member.userId, staff.user.id));
    const [staffMember] = await db
      .insert(member)
      .values({ id: randomUUID(), organizationId: orgId, userId: staff.user.id, role: "staff", createdAt: new Date() })
      .returning();

    const [teamA] = await db.insert(teams).values({ orgId, name: "Team A" }).returning();
    const [teamB] = await db.insert(teams).values({ orgId, name: "Team B" }).returning();
    await db.insert(teamMemberships).values([
      { teamId: teamA!.id, memberId: staffMember!.id },
      { teamId: teamB!.id, memberId: staffMember!.id },
    ]);
    await db.insert(teamPrivileges).values([
      { teamId: teamA!.id, capability: "contacts.edit_own", granted: true },
      { teamId: teamB!.id, capability: "quotes.send", granted: true },
      { teamId: teamA!.id, capability: "ledger.view", granted: false },
    ]);

    const result = await getEffectiveCapabilities(db, { orgId, userId: staff.user.id });
    expect(result["contacts.edit_own"]).toBe(true);
    expect(result["quotes.send"]).toBe(true);
    expect(result["ledger.view"]).toBe(false);
    expect(result["contacts.edit_others"]).toBe(false);

    await db.delete(user).where(eq(user.id, owner.user.id));
    await db.delete(user).where(eq(user.id, staff.user.id));
  });

  it("a user with no membership in the org gets every capability false", async () => {
    const ownerEmail = `caps-nomember-owner-${randomUUID()}@example.com`;
    const strangerEmail = `caps-nomember-stranger-${randomUUID()}@example.com`;
    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "Owner" } });
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const stranger = await auth.api.signUpEmail({ body: { email: strangerEmail, password: "testpassword123", name: "Stranger" } });

    const result = await getEffectiveCapabilities(db, { orgId, userId: stranger.user.id });
    for (const capability of CAPABILITIES) {
      expect(result[capability]).toBe(false);
    }

    await db.delete(user).where(eq(user.id, owner.user.id));
    await db.delete(user).where(eq(user.id, stranger.user.id));
  });
});
