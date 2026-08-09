import { randomUUID } from "node:crypto";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "./auth";
import { CAPABILITY_KEY } from "./require-capability.decorator";
import { CapabilityGuard } from "./capability.guard";
import { createDb, type Database } from "../db/client";
import { member, teamMemberships, teamPrivileges, teams, user } from "../db/schema";

/**
 * Requires the `db` service from docker-compose.dev.yml running locally.
 * Builds a minimal fake ExecutionContext carrying only what canActivate
 * reads (request.session, plus a Reflector-resolvable required capability)
 * — no full Nest HTTP request needed to exercise this guard's logic.
 */
function fakeContext(requiredCapability: string | undefined, session: unknown): ExecutionContext {
  return {
    getHandler: () => (requiredCapability ? Object.assign(() => {}, { [CAPABILITY_KEY]: requiredCapability }) : () => {}),
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ session }),
    }),
  } as unknown as ExecutionContext;
}

class FakeReflector extends Reflector {
  constructor(private readonly value: string | undefined) {
    super();
  }
  override getAllAndOverride<T>(): T | undefined {
    return this.value as T | undefined;
  }
}

describe("CapabilityGuard (requires local Postgres)", () => {
  let db: Database;
  const createdEmails: string[] = [];

  let orgId: string;
  let ownerUserId: string;
  let staffUserId: string;
  let staffMemberId: string;
  let fieldUserId: string;

  afterAll(async () => {
    if (createdEmails.length === 0) return;
    await db.delete(user).where(inArray(user.email, createdEmails));
  });

  beforeEach(async () => {
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");

    const ownerEmail = `capability-guard-owner-${randomUUID()}@example.com`;
    const staffEmail = `capability-guard-staff-${randomUUID()}@example.com`;
    const fieldEmail = `capability-guard-field-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail, staffEmail, fieldEmail);

    const owner = await auth.api.signUpEmail({
      body: { email: ownerEmail, password: "testpassword123", name: "Guard Test Owner" },
    });
    ownerUserId = owner.user.id;
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const staffUser = await auth.api.signUpEmail({
      body: { email: staffEmail, password: "testpassword123", name: "Guard Test Staff" },
    });
    staffUserId = staffUser.user.id;
    await db.delete(member).where(eq(member.userId, staffUser.user.id));
    const [staffMember] = await db
      .insert(member)
      .values({ id: randomUUID(), organizationId: orgId, userId: staffUser.user.id, role: "staff", createdAt: new Date() })
      .returning();
    staffMemberId = staffMember!.id;

    const fieldUser = await auth.api.signUpEmail({
      body: { email: fieldEmail, password: "testpassword123", name: "Guard Test Field" },
    });
    fieldUserId = fieldUser.user.id;
    await db.delete(member).where(eq(member.userId, fieldUser.user.id));
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: orgId,
      userId: fieldUser.user.id,
      role: "field",
      createdAt: new Date(),
    });
  });

  function guardFor(requiredCapability: string | undefined) {
    return new CapabilityGuard(new FakeReflector(requiredCapability) as Reflector, db);
  }

  it("no-ops (returns true) when no @RequireCapability metadata is present", async () => {
    const guard = guardFor(undefined);
    const context = fakeContext(undefined, { session: { activeOrganizationId: orgId }, user: { id: staffUserId } });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("Owner bypasses the capability check entirely", async () => {
    const guard = guardFor("ledger.view");
    const context = fakeContext("ledger.view", { session: { activeOrganizationId: orgId }, user: { id: ownerUserId } });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("Field is always rejected when @RequireCapability is present", async () => {
    const guard = guardFor("contacts.manage");
    const context = fakeContext("contacts.manage", {
      session: { activeOrganizationId: orgId },
      user: { id: fieldUserId },
    });
    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  it("Staff with no Teams is rejected", async () => {
    const guard = guardFor("quotes.manage");
    const context = fakeContext("quotes.manage", {
      session: { activeOrganizationId: orgId },
      user: { id: staffUserId },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(/missing capability/i);
  });

  it("Staff with a Team granting the capability passes", async () => {
    const [team] = await db.insert(teams).values({ orgId, name: "Grant Team" }).returning();
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId: staffMemberId });
    await db.insert(teamPrivileges).values({ teamId: team!.id, capability: "quotes.manage", granted: true });

    const guard = guardFor("quotes.manage");
    const context = fakeContext("quotes.manage", {
      session: { activeOrganizationId: orgId },
      user: { id: staffUserId },
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("Staff with multiple Teams passes if ANY of them grants the capability (union semantics)", async () => {
    const [teamA] = await db.insert(teams).values({ orgId, name: "Team A" }).returning();
    const [teamB] = await db.insert(teams).values({ orgId, name: "Team B" }).returning();
    await db.insert(teamMemberships).values([
      { teamId: teamA!.id, memberId: staffMemberId },
      { teamId: teamB!.id, memberId: staffMemberId },
    ]);
    // Team A explicitly denies, Team B grants — union should still pass.
    await db.insert(teamPrivileges).values([
      { teamId: teamA!.id, capability: "ledger.view", granted: false },
      { teamId: teamB!.id, capability: "ledger.view", granted: true },
    ]);

    const guard = guardFor("ledger.view");
    const context = fakeContext("ledger.view", {
      session: { activeOrganizationId: orgId },
      user: { id: staffUserId },
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rejects when session has no active organisation", async () => {
    const guard = guardFor("quotes.manage");
    const context = fakeContext("quotes.manage", { session: {}, user: { id: staffUserId } });
    await expect(guard.canActivate(context)).rejects.toThrow(/no active organisation/i);
  });
});
