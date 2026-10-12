import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { jobAssignments, jobs, member, milestones, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { AuditLogService } from "../audit/audit-log.service";

type Who = { cookie: string; userId: string };

/**
 * US-JOB-19 — Field users reach only their assigned jobs, never a job's
 * money; job costing needs `reports.view_job_profitability`. A demo-seeded
 * org with an Owner, a Field user assigned to one job, a Staff member with
 * no grants and one granted job profitability. Requires local Postgres.
 */
describe("US-JOB-19 · keep money and unassigned jobs away from field crew (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const createdEmails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const staffWithCosting: Who = { cookie: "", userId: "" };
  let assignedJobId: string;
  let otherJobId: string;

  const get = (route: string, who: Who) => fetch(`${testApp.baseUrl}${route}`, { headers: { cookie: who.cookie } });
  const json = async <T>(route: string, who: Who): Promise<T> => {
    const res = await get(route, who);
    expect(res.status, route).toBe(200);
    return (await res.json()) as T;
  };

  async function newUser(name: string): Promise<Who> {
    const email = `us-job-19-${name}-${randomUUID()}@example.com`;
    createdEmails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  async function joinOrg(who: Who, role: "staff" | "field"): Promise<string> {
    await db.delete(member).where(eq(member.userId, who.userId));
    const [row] = await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() }).returning();
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    return row!.id;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");

    Object.assign(owner, await newUser("owner"));
    const [m] = await db.select().from(member).where(eq(member.userId, owner.userId));
    orgId = m!.organizationId;
    const seeded = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie: owner.cookie, "Idempotency-Key": randomUUID() } });
    expect(seeded.status).toBeLessThan(300);

    Object.assign(field, await newUser("field"));
    await joinOrg(field, "field");
    Object.assign(staff, await newUser("staff"));
    // US-TEAM-30: their Team opens Jobs.
    const [jobsTeam] = await db.insert(teams).values({ orgId, name: `Jobs ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values({ teamId: jobsTeam!.id, capability: "jobs.open", granted: true });
    await db.insert(teamMemberships).values({ teamId: jobsTeam!.id, memberId: await joinOrg(staff, "staff") });
    Object.assign(staffWithCosting, await newUser("staff-costing"));
    const memberId = await joinOrg(staffWithCosting, "staff");
    const [team] = await db.insert(teams).values({ orgId, name: `Costing ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values([
      { teamId: team!.id, capability: "jobs.open", granted: true },
      { teamId: team!.id, capability: "reports.view_job_profitability", granted: true },
    ]);
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });

    const [a, b] = await db.select().from(jobs).where(eq(jobs.orgId, orgId)).limit(2);
    assignedJobId = a!.id;
    otherJobId = b!.id;
    await db.insert(jobAssignments).values({ jobId: assignedJobId, userId: field.userId, orgId });
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    if (createdEmails.length) await db.delete(user).where(inArray(user.email, createdEmails));
  });

  it("lists only Field's assigned jobs, with or without assignedToMe", async () => {
    for (const route of ["/jobs", "/jobs?assignedToMe=true"]) {
      const rows = await json<{ id: string }[]>(route, field);
      expect(rows.map((r) => r.id)).toEqual([assignedJobId]);
    }
    const all = await json<{ id: string }[]>("/jobs", owner);
    expect(all.length).toBeGreaterThan(1);
  });

  it("answers 404 for a job Field isn't assigned to, and for its milestones, photos, notes and history", async () => {
    for (const suffix of ["", "/milestones", "/photos", "/notes", "/history", "/variation-orders", "/assignees"]) {
      expect((await get(`/jobs/${otherJobId}${suffix}`, field)).status, suffix || "job").toBe(404);
      expect((await get(`/jobs/${assignedJobId}${suffix}`, field)).status, suffix || "job").toBe(200);
    }
  });

  it("never sends Field a job's money", async () => {
    const [listed] = await json<Record<string, unknown>[]>("/jobs", field);
    const job = await json<Record<string, unknown>>(`/jobs/${assignedJobId}`, field);
    for (const row of [listed!, job]) {
      expect(row).not.toHaveProperty("contractValueAmount");
      expect(row).not.toHaveProperty("retentionPct");
      expect(row.name).toBeTruthy();
    }
    const rows = await json<Record<string, unknown>[]>(`/jobs/${assignedJobId}/milestones`, field);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).not.toHaveProperty("amount");
      expect(row).not.toHaveProperty("resolvedAmount");
    }
    // Owners and Staff are unaffected.
    expect(await json<Record<string, unknown>>(`/jobs/${assignedJobId}`, staff)).toHaveProperty("contractValueAmount");
  });

  it("takes money changes out of the job history Field sees", async () => {
    await testApp.app.get(AuditLogService).record(db, {
      orgId,
      actorUserId: owner.userId,
      action: "variation_applied",
      entityType: "job",
      entityId: assignedJobId,
      contactId: null,
      changes: [
        { field: "contractValueAmount", from: "100000", to: "150000" },
        { field: "status", from: "active", to: "active" },
      ],
    });
    const asField = await json<{ action: string; changes: { field: string }[] }[]>(`/jobs/${assignedJobId}/history`, field);
    const asOwner = await json<{ action: string; changes: { field: string }[] }[]>(`/jobs/${assignedJobId}/history`, owner);
    const fieldRow = asField.find((r) => r.action === "variation_applied")!;
    const ownerRow = asOwner.find((r) => r.action === "variation_applied")!;
    expect(fieldRow.changes.map((c) => c.field)).toEqual(["status"]);
    expect(ownerRow.changes.map((c) => c.field)).toEqual(["contractValueAmount", "status"]);
  });

  it("needs reports.view_job_profitability for job costing", async () => {
    expect((await get(`/jobs/${assignedJobId}/costing`, field)).status).toBe(403);
    expect((await get(`/jobs/${assignedJobId}/costing`, staff)).status).toBe(403);
    expect((await get(`/jobs/${assignedJobId}/costing`, staffWithCosting)).status).toBe(200);
    expect((await get(`/jobs/${assignedJobId}/costing`, owner)).status).toBe(200);
  });

  it("shows Field only milestones due on their assigned jobs", async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.update(milestones).set({ status: "pending", dueDate: tomorrow }).where(inArray(milestones.jobId, [assignedJobId, otherJobId]));
    const due = await json<{ jobId: string }[]>("/jobs/milestones/due", field);
    expect(due.length).toBeGreaterThan(0);
    expect(due.every((m) => m.jobId === assignedJobId)).toBe(true);
    const ownerDue = await json<{ jobId: string }[]>("/jobs/milestones/due", owner);
    expect(ownerDue.some((m) => m.jobId === otherJobId)).toBe(true);
  });

  it("won't let Field add notes or photos to a job they aren't assigned to", async () => {
    for (const suffix of ["notes", "photos"]) {
      const res = await fetch(`${testApp.baseUrl}/jobs/${otherJobId}/${suffix}`, {
        method: "POST",
        headers: { cookie: field.cookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" },
        body: JSON.stringify({ body: "on site", fileId: randomUUID() }),
      });
      expect(res.status, suffix).toBe(404);
    }
  });
});
