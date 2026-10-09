import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { jobAssignments, jobs, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/**
 * US-MOB-04 — after a demo business loads, the demo Field user (Marcus
 * Webb) is on the crew of every demo job, so the field app has jobs to
 * list. Requires local Postgres.
 */
describe("US-MOB-04 · browse my assigned jobs (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-mob-04-owner-${randomUUID()}@example.com`;
    emails.push(email);
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const seeded = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie: owner.cookie, "Idempotency-Key": randomUUID() } });
    expect(seeded.status).toBeLessThan(300);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  it("puts the demo Field user on every demo job's crew", async () => {
    const [marcus] = await db.select({ id: user.id }).from(user).where(eq(user.email, "marcus.webb.demo@example.com"));
    const demoJobs = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.orgId, orgId));
    expect(demoJobs.length).toBeGreaterThan(0);
    const crew = await db.select({ jobId: jobAssignments.jobId }).from(jobAssignments).where(and(eq(jobAssignments.orgId, orgId), eq(jobAssignments.userId, marcus!.id)));
    expect(crew.map((c) => c.jobId).sort()).toEqual(demoJobs.map((j) => j.id).sort());
  });
});
