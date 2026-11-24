import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { contacts, jobs, member, milestones, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-JOB-20 — a job's milestones are owned through the job, by its
 * creator. Staff A and B hold only `milestones.edit_own`; Staff C holds
 * `milestones.edit_others`. Requires local Postgres.
 */
describe("US-JOB-20 · own a job's milestones through the job (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const createdEmails: string[] = [];
  let orgId: string;
  let contactId: string;
  const a: Who = { cookie: "", userId: "" };
  const b: Who = { cookie: "", userId: "" };
  const c: Who = { cookie: "", userId: "" };

  const setMilestones = (who: Who, jobId: string, names = ["Deposit", "Handover"]) =>
    fetch(`${testApp.baseUrl}/jobs/${jobId}/milestones`, {
      method: "PUT",
      headers: { cookie: who.cookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" },
      body: JSON.stringify({ milestones: names.map((name, i) => ({ name, sequence: i, amountType: "percent", amount: 100 / names.length })) }),
    });

  async function jobCreatedBy(createdByUserId: string | null) {
    const [job] = await db.insert(jobs).values({ orgId, contactId, name: `Job ${randomUUID().slice(0, 6)}`, currency: "USD", contractValueAmount: 1000000n, createdByUserId }).returning();
    return job!.id;
  }

  async function staffWith(who: Who, name: string, capability: string) {
    const email = `us-job-20-${name.replace(/\s+/g, "-").toLowerCase()}-${randomUUID()}@example.com`;
    createdEmails.push(email);
    Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    await db.delete(member).where(eq(member.userId, who.userId));
    const [row] = await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role: "staff", createdAt: new Date() }).returning();
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `${name} ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values([{ teamId: team!.id, capability: "jobs.open", granted: true }, { teamId: team!.id, capability, granted: true }]);
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId: row!.id });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-job-20-owner-${randomUUID()}@example.com`;
    createdEmails.push(email);
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    const [m] = await db.select().from(member).where(eq(member.userId, owner.userId));
    orgId = m!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Harborview" }).returning();
    contactId = contact!.id;
    await staffWith(a, "Staff A", "milestones.edit_own");
    await staffWith(b, "Staff B", "milestones.edit_own");
    await staffWith(c, "Staff C", "milestones.edit_others");
  });

  afterAll(async () => {
    await testApp?.close();
    if (createdEmails.length) await db.delete(user).where(inArray(user.email, createdEmails));
  });

  it("lets a member with milestones.edit_own define and edit milestones on a job they created", async () => {
    const jobId = await jobCreatedBy(a.userId);
    expect((await setMilestones(a, jobId)).status).toBe(200);
    expect((await setMilestones(a, jobId, ["Deposit", "Frame", "Fit-out", "Handover"])).status).toBe(200);
  });

  it("refuses them on a job a colleague created (403)", async () => {
    const jobId = await jobCreatedBy(a.userId);
    expect((await setMilestones(b, jobId)).status).toBe(403);
  });

  it("lets a member with milestones.edit_others edit a colleague's job, and ownership stays with the job's creator", async () => {
    const jobId = await jobCreatedBy(a.userId);
    expect((await setMilestones(c, jobId)).status).toBe(200);
    // C replaced the set; A still owns it through the job, B still doesn't.
    expect((await setMilestones(a, jobId)).status).toBe(200);
    expect((await setMilestones(b, jobId)).status).toBe(403);
    expect((await db.select().from(milestones).where(eq(milestones.jobId, jobId))).length).toBe(2);
  });

  it("treats a job with no recorded creator as nobody's own", async () => {
    const jobId = await jobCreatedBy(null);
    expect((await setMilestones(a, jobId)).status).toBe(403);
    expect((await setMilestones(c, jobId)).status).toBe(200);
  });
});
