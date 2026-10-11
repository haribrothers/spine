import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { expenseCategories, expenses, notifications, settings, user } from "../../db/schema";
import { forgetModules } from "../../common/modules";
import { createTestApp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";
import { bearer, bearerSignIn, customerWithJob, ownerWithFieldUser } from "./field-user.test-helper";

type Row = { id: string; type: string; message: string; detail: string | null; link: string | null; readAt: string | null };

/**
 * US-MOB-22 — the notifications a Field user gets on the phone: their
 * expense approved or rejected (with the reason), being put on or taken
 * off a crew; nothing while the module is off; read with the bearer
 * session and marked read. Requires local Postgres.
 */
describe("US-MOB-22 · see my notifications on the phone (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let ctx: Awaited<ReturnType<typeof ownerWithFieldUser>>;
  let token: string;
  let categoryId: string;
  let ownerUserId: string;

  const post = (path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method: "POST",
      headers: { cookie: ctx.ownerCookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  const mine = async (): Promise<Row[]> => {
    const res = await fetch(`${testApp.baseUrl}/notifications`, { headers: bearer(token) });
    expect(res.status).toBe(200);
    return (await res.json()) as Row[];
  };
  const submitted = async (amount: bigint) => {
    const [row] = await db.insert(expenses).values({ orgId: ctx.orgId, categoryId, date: new Date(), currency: "USD", amount, submittedByUserId: ctx.fieldUserId }).returning();
    return row!.id;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    ctx = await ownerWithFieldUser(testApp.baseUrl, db, emails);
    [{ id: ownerUserId }] = (await db.select({ id: user.id }).from(user).where(eq(user.email, emails[0]!))) as [{ id: string }];
    const [category] = await db.insert(expenseCategories).values({ orgId: ctx.orgId, name: "Fuel & Vehicle" }).returning();
    categoryId = category!.id;
    token = (await bearerSignIn(testApp.baseUrl, ctx.fieldEmail, "testpassword123")).token!;
  }, 60_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  it("tells Marcus his expense was rejected, with the reason", async () => {
    const id = await submitted(3850n);
    expect((await post(`/expenses/${id}/reject`, { comment: "No receipt attached — please add one next time." })).status).toBeLessThan(300);
    const row = (await mine()).find((n) => n.link === `/expenses/${id}`);
    expect(row).toMatchObject({ type: "expense_rejected", message: "Mob Owner rejected your expense", detail: "Fuel & Vehicle · $38.50 · “No receipt attached — please add one next time.”", readAt: null });
  });

  it("tells Marcus his expense was approved, and the office's copy goes to the office only", async () => {
    const id = await submitted(19200n);
    expect((await post(`/expenses/${id}/approve`, {})).status).toBeLessThan(300);
    const rows = (await mine()).filter((n) => n.link === `/expenses/${id}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "expense_approved", message: "Mob Owner approved your expense", detail: "Fuel & Vehicle · $192.00" });
  });

  it("tells Marcus when he's put on a crew and taken off it, never about the job's money", async () => {
    const { jobId } = await customerWithJob(db, ctx.orgId, { job: { name: "Phase 2 townhomes — foundations", siteAddress: "220 Ridge Rd, Burlington, VT 05401" } });
    expect((await post(`/jobs/${jobId}/assignees`, { userId: ctx.fieldUserId })).status).toBeLessThan(300);
    const added = (await mine()).find((n) => n.type === "crew_assigned");
    expect(added).toMatchObject({ message: "You're on the crew for Phase 2 townhomes — foundations", detail: "Added by Mob Owner · 220 Ridge Rd, Burlington, VT 05401", link: `/jobs/${jobId}` });

    const removed = await fetch(`${testApp.baseUrl}/jobs/${jobId}/assignees/${ctx.fieldUserId}`, { method: "DELETE", headers: { cookie: ctx.ownerCookie, "Idempotency-Key": randomUUID() } });
    expect(removed.status).toBe(200);
    expect((await mine()).find((n) => n.type === "crew_removed")).toMatchObject({ message: "You're off the crew for Phase 2 townhomes — foundations", detail: "Removed by Mob Owner", link: null });
    for (const row of await mine()) expect(`${row.message} ${row.detail ?? ""}`).not.toMatch(/48,000|\$48/);
  });

  it("sends nothing about a switched-off module", async () => {
    await db.insert(settings).values({ orgId: ctx.orgId, key: "modules", value: { leadsMeetings: true, jobsField: false, approvals: true, recurring: true } });
    forgetModules(ctx.orgId);
    try {
      const { jobId } = await customerWithJob(db, ctx.orgId);
      await testApp.app.get((await import("../jobs/jobs.service")).JobsService).assign(ctx.orgId, jobId, ownerUserId, { userId: ctx.fieldUserId });
      const crew = await db.select().from(notifications).where(and(eq(notifications.recipientUserId, ctx.fieldUserId), eq(notifications.link, `/jobs/${jobId}`)));
      expect(crew).toHaveLength(0);
    } finally {
      await db.delete(settings).where(eq(settings.orgId, ctx.orgId));
      forgetModules(ctx.orgId);
    }
  });

  it("marks one read, then all of them, with the phone's session", async () => {
    const before = await mine();
    expect(before.length).toBeGreaterThan(1);
    const one = await fetch(`${testApp.baseUrl}/notifications/${before[0]!.id}/read`, { method: "POST", headers: bearer(token, { "Idempotency-Key": randomUUID() }) });
    expect(one.status).toBeLessThan(300);
    const count = async () => ((await (await fetch(`${testApp.baseUrl}/notifications/unread-count`, { headers: bearer(token) })).json()) as { count: number }).count;
    expect(await count()).toBe(before.length - 1);
    await fetch(`${testApp.baseUrl}/notifications/read-all`, { method: "POST", headers: bearer(token, { "Idempotency-Key": randomUUID() }) });
    expect(await count()).toBe(0);
  });
});
