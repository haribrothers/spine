import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

interface MemberResponse {
  id: string;
  role: string;
  isActive: boolean;
}

/**
 * Requires the `db` service from docker-compose.dev.yml running locally.
 *
 * The service-layer tests in members.service.integration.test.ts already
 * cover promote/demote/transfer's business logic thoroughly (Primary Owner
 * protection, sole-owner guards, etc.) by calling MembersService directly.
 * What that approach structurally cannot prove is that the REAL route is
 * actually reachable through the REAL guard chain — @OrgRoles and
 * CapabilityGuard only run when a request goes through NestJS's routing,
 * not when a test calls a service method. This file boots the real
 * AppModule (see test-app.ts) and hits real HTTP routes with real session
 * cookies, so it's the one place asserting a Staff session genuinely gets
 * a 403 from an owner-only endpoint, not just that the service would
 * reject the call if you skipped the guard entirely.
 */
describe("MembersController HTTP (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const createdEmails: string[] = [];

  let orgId: string;
  let ownerCookie: string;
  let staffMemberId: string;
  let staffCookie: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  });

  afterAll(async () => {
    await testApp.close();
    if (createdEmails.length > 0) {
      await db.delete(user).where(inArray(user.email, createdEmails));
    }
  });

  beforeEach(async () => {
    const ownerEmail = `members-http-owner-${randomUUID()}@example.com`;
    const staffEmail = `members-http-staff-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail, staffEmail);

    const owner = await signUp(testApp.baseUrl, { email: ownerEmail, password: "testpassword123", name: "HTTP Test Owner" });
    ownerCookie = owner.cookie;
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.userId));
    orgId = ownerMembership!.organizationId;

    const staffSignup = await signUp(testApp.baseUrl, { email: staffEmail, password: "testpassword123", name: "HTTP Test Staff" });
    staffCookie = staffSignup.cookie;
    // Simulate an accepted Staff invite — no invitation-accept flow exists
    // yet for automated tests to drive (see CLAUDE.md's own note on this),
    // so reassign this user's membership into the owner's org directly.
    await db.delete(member).where(eq(member.userId, staffSignup.userId));
    const [staffMember] = await db
      .insert(member)
      .values({ id: randomUUID(), organizationId: orgId, userId: staffSignup.userId, role: "staff", createdAt: new Date() })
      .returning();
    staffMemberId = staffMember!.id;

    // The signup hook's session.create.after backfill points activeOrganizationId
    // at each user's own freshly-created org — repoint the Staff session at
    // the org under test, same as the membership reassignment above, so
    // requireOrgId(session) resolves the right org for subsequent requests.
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staffSignup.userId));
  });

  it("deactivate then reactivate a Staff member via real HTTP", async () => {
    const deactivateRes = await fetch(`${testApp.baseUrl}/org/members/${staffMemberId}/deactivate`, {
      method: "PUT",
      headers: { cookie: ownerCookie, "Idempotency-Key": randomUUID() },
    });
    expect(deactivateRes.status).toBe(200);
    const deactivated = (await deactivateRes.json()) as MemberResponse;
    expect(deactivated.isActive).toBe(false);

    const reactivateRes = await fetch(`${testApp.baseUrl}/org/members/${staffMemberId}/reactivate`, {
      method: "PUT",
      headers: { cookie: ownerCookie, "Idempotency-Key": randomUUID() },
    });
    expect(reactivateRes.status).toBe(200);
    const reactivated = (await reactivateRes.json()) as MemberResponse;
    expect(reactivated.isActive).toBe(true);
  });

  it("promote then demote a Staff member via real HTTP", async () => {
    const promoteRes = await fetch(`${testApp.baseUrl}/org/members/${staffMemberId}/promote`, {
      method: "PUT",
      headers: { cookie: ownerCookie, "Idempotency-Key": randomUUID() },
    });
    expect(promoteRes.status).toBe(200);
    const promoted = (await promoteRes.json()) as MemberResponse;
    expect(promoted.role).toBe("owner");

    const demoteRes = await fetch(`${testApp.baseUrl}/org/members/${staffMemberId}/demote`, {
      method: "PUT",
      headers: { cookie: ownerCookie, "Idempotency-Key": randomUUID() },
    });
    expect(demoteRes.status).toBe(200);
    const demoted = (await demoteRes.json()) as MemberResponse;
    expect(demoted.role).toBe("staff");
  });

  it("rejects a Staff session hitting owner-only deactivate/promote/demote with a real 403", async () => {
    const deactivateRes = await fetch(`${testApp.baseUrl}/org/members/${staffMemberId}/deactivate`, {
      method: "PUT",
      headers: { cookie: staffCookie, "Idempotency-Key": randomUUID() },
    });
    expect(deactivateRes.status).toBe(403);

    const promoteRes = await fetch(`${testApp.baseUrl}/org/members/${staffMemberId}/promote`, {
      method: "PUT",
      headers: { cookie: staffCookie, "Idempotency-Key": randomUUID() },
    });
    expect(promoteRes.status).toBe(403);
  });

  it("rejects deactivate/promote/demote with no session at all (401)", async () => {
    const res = await fetch(`${testApp.baseUrl}/org/members/${staffMemberId}/deactivate`, {
      method: "PUT",
      headers: { "Idempotency-Key": randomUUID() },
    });
    expect(res.status).toBe(401);
  });
});
