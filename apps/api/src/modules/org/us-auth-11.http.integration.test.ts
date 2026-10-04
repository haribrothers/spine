import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { invitation, member, organization, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/**
 * US-AUTH-11 — the public invitation preview says whether a link can be
 * used, and names the business only while it can. Requires local Postgres.
 */
describe("US-AUTH-11 · see why an invitation can't be used (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-auth-11-${randomUUID()}@example.com`;
  let orgId: string;
  let orgName: string;
  let ownerId: string;

  const preview = (id: string) => fetch(`${testApp.baseUrl}/public/invitations/${id}`);
  async function invite(status: string, expiresInMs: number): Promise<string> {
    const id = randomUUID();
    await db.insert(invitation).values({
      id,
      organizationId: orgId,
      email: `invitee-${id}@example.com`,
      role: "staff",
      status,
      expiresAt: new Date(Date.now() + expiresInMs),
      inviterId: ownerId,
    });
    return id;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    ownerId = (await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" })).userId;
    const [m] = await db.select().from(member).where(eq(member.userId, ownerId));
    orgId = m!.organizationId;
    orgName = (await db.select().from(organization).where(eq(organization.id, orgId)))[0]!.name;
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("returns 404 for an id that doesn't exist, without naming any business", async () => {
    const res = await preview(randomUUID());
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain(orgName);
  });

  it("a pending invitation shows its email, role and business", async () => {
    const id = await invite("pending", 60 * 60_000);
    const body = await (await preview(id)).json();
    expect(body).toEqual({ status: "pending", email: `invitee-${id}@example.com`, role: "staff", organizationName: orgName });
  });

  it("an expired pending invitation reports 'expired' and nothing else", async () => {
    const id = await invite("pending", -1000);
    expect(await (await preview(id)).json()).toEqual({ status: "expired" });
  });

  it.each(["canceled", "accepted", "rejected"])("a %s invitation reports its status and nothing else", async (status) => {
    const id = await invite(status, 60 * 60_000);
    expect(await (await preview(id)).json()).toEqual({ status });
  });
});
