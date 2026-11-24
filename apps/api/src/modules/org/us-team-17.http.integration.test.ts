import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/** US-TEAM-17 — the Primary Owner can't be deactivated, even by another Owner. Requires local Postgres. */
describe("US-TEAM-17 · protect the Primary Owner's row (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const createdEmails: string[] = [];
  let primaryMemberId: string;
  let otherOwnerCookie: string;
  let primaryCookie: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const primaryEmail = `us-team-17-primary-${randomUUID()}@example.com`;
    const otherEmail = `us-team-17-owner-${randomUUID()}@example.com`;
    createdEmails.push(primaryEmail, otherEmail);
    const primary = await signUp(testApp.baseUrl, { email: primaryEmail, password: "testpassword123", name: "Primary Owner" });
    primaryCookie = primary.cookie;
    const [primaryMember] = await db.select().from(member).where(eq(member.userId, primary.userId));
    primaryMemberId = primaryMember!.id;
    expect(primaryMember!.isPrimaryOwner).toBe(true);

    const other = await signUp(testApp.baseUrl, { email: otherEmail, password: "testpassword123", name: "Second Owner" });
    otherOwnerCookie = other.cookie;
    await db.delete(member).where(eq(member.userId, other.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: primaryMember!.organizationId, userId: other.userId, role: "owner", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: primaryMember!.organizationId }).where(eq(sessionTable.userId, other.userId));
  });

  afterAll(async () => {
    await testApp?.close();
    if (createdEmails.length) await db.delete(user).where(inArray(user.email, createdEmails));
  });

  it("refuses to deactivate the Primary Owner (400), whoever asks", async () => {
    for (const cookie of [otherOwnerCookie, primaryCookie]) {
      const res = await fetch(`${testApp.baseUrl}/org/members/${primaryMemberId}/deactivate`, {
        method: "PUT",
        headers: { cookie, "Idempotency-Key": randomUUID() },
      });
      expect(res.status).toBe(400);
    }
    const [row] = await db.select().from(member).where(eq(member.id, primaryMemberId));
    expect(row?.isActive).toBe(true);
  });
});
