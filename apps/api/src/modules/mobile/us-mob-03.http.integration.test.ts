import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { contactPersons, expenseCategories, expenses, files, jobAssignments, jobPhotos, meetingAttendees, meetings, milestones, settings, user } from "../../db/schema";
import { forgetModules } from "../../common/modules";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";
import { MobileTodayService, periodBounds } from "./mobile-today.service";
import { bearer, bearerSignIn, customerWithJob, ownerWithFieldUser } from "./field-user.test-helper";

const day = (date: string) => new Date(`${date}T00:00:00Z`);
const at = (date: string) => new Date(`${date}T12:00:00Z`);

/**
 * US-MOB-03 — what the phone's Today reads: the gauge and KPI figures
 * (`GET /mobile/today`), job cards with who to call (`include=site_contact`)
 * and my next meeting (`GET /meetings/upcoming?attending=true`). Requires
 * local Postgres.
 */
describe("US-MOB-03 · see today's jobs with addresses and tap-to-call (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let ctx: Awaited<ReturnType<typeof ownerWithFieldUser>>;
  let token: string;
  let jobId: string;
  let otherJobId: string;
  let soloJobId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(undefined);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    ctx = await ownerWithFieldUser(testApp.baseUrl, db, emails);
    const [owner] = await db.select().from(user).where(inArray(user.email, emails.slice(0, 1)));
    ownerUserId = owner!.id;

    const harborview = await customerWithJob(db, ctx.orgId, { customer: { phone: "+1 207 555 0100" } });
    jobId = harborview.jobId;
    await db.insert(contactPersons).values([
      { contactId: harborview.contactId, name: "Dana Fox", title: "Accounts", phone: "+1 207 555 0111", isPrimary: false },
      { contactId: harborview.contactId, name: "Alan Reyes", title: "Procurement Manager", phone: null, isPrimary: true },
    ]);
    soloJobId = (await customerWithJob(db, ctx.orgId, { customer: { name: "Sarah Kim", phone: "+1 802 555 0199" } })).jobId;
    otherJobId = (await customerWithJob(db, ctx.orgId)).jobId;
    await db.insert(jobAssignments).values([
      { jobId, userId: ctx.fieldUserId, orgId: ctx.orgId },
      { jobId: soloJobId, userId: ctx.fieldUserId, orgId: ctx.orgId },
    ]);

    // Milestones on Marcus's job, around Thursday 8 October 2026.
    await db.insert(milestones).values([
      { jobId, orgId: ctx.orgId, name: "Mobilisation", sequence: 0, dueDate: day("2026-10-10") },
      { jobId, orgId: ctx.orgId, name: "Framing", sequence: 1, dueDate: day("2026-10-06") },
      { jobId, orgId: ctx.orgId, name: "Fit-out", sequence: 2, dueDate: day("2026-11-03") },
      { jobId, orgId: ctx.orgId, name: "Site setup", sequence: 3, status: "completed", dueDate: day("2026-10-01"), completedAt: at("2026-10-02") },
      { jobId, orgId: ctx.orgId, name: "Survey", sequence: 4, status: "completed", dueDate: day("2026-09-18"), completedAt: at("2026-09-20") },
      // Not his job: never counted.
      { jobId: otherJobId, orgId: ctx.orgId, name: "Elsewhere", sequence: 0, dueDate: day("2026-10-09") },
    ]);

    const [file] = await db.insert(files).values({ orgId: ctx.orgId, key: `test/${randomUUID()}`, originalFilename: "site.jpg", mimeType: "image/jpeg", sizeBytes: 10 }).returning();
    await db.insert(jobPhotos).values([
      { jobId, orgId: ctx.orgId, fileId: file!.id, uploadedByUserId: ctx.fieldUserId, createdAt: at("2026-10-05") },
      { jobId, orgId: ctx.orgId, fileId: file!.id, uploadedByUserId: ctx.fieldUserId, createdAt: at("2026-09-28") },
      { jobId, orgId: ctx.orgId, fileId: file!.id, uploadedByUserId: ownerUserId, createdAt: at("2026-10-05") },
    ]);

    const [category] = await db.insert(expenseCategories).values({ orgId: ctx.orgId, name: `Fuel ${randomUUID()}` }).returning();
    const expense = (amount: bigint, date: string, status: "submitted" | "approved" | "rejected", by = ctx.fieldUserId) => ({ orgId: ctx.orgId, categoryId: category!.id, date: day(date), currency: "USD", amount, status, submittedByUserId: by });
    await db.insert(expenses).values([
      expense(6420n, "2026-10-04", "submitted"),
      expense(4200n, "2026-10-01", "approved"),
      expense(3850n, "2026-10-03", "rejected"),
      expense(9999n, "2026-10-04", "submitted", ownerUserId),
    ]);

    token = (await bearerSignIn(testApp.baseUrl, ctx.fieldEmail, "testpassword123")).token!;
  }, 60_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  it("works out the week (Monday to Sunday), month and year around a day", () => {
    expect(periodBounds("2026-10-08", "week")).toEqual({ from: "2026-10-05", to: "2026-10-11" });
    expect(periodBounds("2026-10-11", "week")).toEqual({ from: "2026-10-05", to: "2026-10-11" });
    expect(periodBounds("2026-10-08", "month")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodBounds("2026-02-10", "month")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(periodBounds("2026-10-08", "year")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("gives the gauge and KPI cards for this month: milestones on my jobs, my photos and my own expenses", async () => {
    const summary = await testApp.app.get(MobileTodayService).summary(ctx.orgId, ctx.fieldUserId, "month", at("2026-10-08"));
    expect(summary.milestones).toEqual({ done: 1, total: 3, due: 1, nextDueDate: "2026-10-10", overdue: 1, oldestOverdueDate: "2026-10-06" });
    expect(summary.photos).toEqual({ taken: 1 });
    expect(summary.expenses).toEqual({ total: "10620", count: 2, awaitingApproval: 1, currency: "USD" });
  });

  it("follows the switch: this week and this year count their own period", async () => {
    const today = testApp.app.get(MobileTodayService);
    const week = await today.summary(ctx.orgId, ctx.fieldUserId, "week", at("2026-10-08"));
    expect(week.milestones).toMatchObject({ done: 0, total: 2, due: 1, overdue: 1 });
    expect(week.photos).toEqual({ taken: 1 });
    expect(week.expenses).toMatchObject({ total: "0", count: 0 });
    const year = await today.summary(ctx.orgId, ctx.fieldUserId, "year", at("2026-10-08"));
    expect(year.milestones).toMatchObject({ done: 2, total: 5, due: 2, overdue: 1 });
    expect(year.photos).toEqual({ taken: 2 });
  });

  it("answers the phone over HTTP with no money but the caller's own expenses, and refuses an unknown period", async () => {
    const res = await fetch(`${testApp.baseUrl}/mobile/today?period=week`, { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["expenses", "from", "milestones", "period", "photos", "to", "today"]);
    expect((await fetch(`${testApp.baseUrl}/mobile/today?period=decade`, { headers: bearer(token) })).status).toBe(400);
  });

  it("tells the phone the business currency and locale, to format money and dates", async () => {
    const res = await fetch(`${testApp.baseUrl}/org/members/me`, { headers: bearer(token) });
    expect(await res.json()).toMatchObject({ role: "field", currency: "USD", locale: "en-US" });
  });

  it("leaves out the job figures while Jobs & field is off", async () => {
    await db.insert(settings).values({ orgId: ctx.orgId, key: "modules", value: { leadsMeetings: true, jobsField: false, approvals: true, recurring: true } });
    forgetModules(ctx.orgId);
    try {
      const summary = await testApp.app.get(MobileTodayService).summary(ctx.orgId, ctx.fieldUserId, "month", at("2026-10-08"));
      expect(summary.milestones).toBeNull();
      expect(summary.photos).toBeNull();
      expect(summary.expenses.count).toBe(2);
    } finally {
      await db.delete(settings).where(inArray(settings.orgId, [ctx.orgId]));
      forgetModules(ctx.orgId);
    }
  });

  it("puts who to call on each job card: the primary contact person, else the customer, with the customer's phone as the fallback", async () => {
    const res = await fetch(`${testApp.baseUrl}/jobs?assignedToMe=true&include=next_milestone,site_contact,milestone_counts`, { headers: bearer(token) });
    expect(res.status).toBe(200);
    const list = (await res.json()) as { id: string; siteAddress: string; nextMilestone: { name: string } | null; milestoneCounts: { total: number; completed: number }; siteContact: { name: string; title: string | null; phone: string | null }; contractValueAmount?: unknown }[];
    expect(list.map((j) => j.id).sort()).toEqual([jobId, soloJobId].sort());
    const harborview = list.find((j) => j.id === jobId)!;
    expect(harborview.siteContact).toEqual({ name: "Alan Reyes", title: "Procurement Manager", phone: "+1 207 555 0100" });
    expect(harborview.siteAddress).toBe("48 Harbor Way, Portland, ME 04101");
    expect(harborview.nextMilestone?.name).toBe("Framing");
    expect(harborview.milestoneCounts).toEqual({ total: 5, completed: 2 });
    expect(list.find((j) => j.id === soloJobId)!.milestoneCounts).toEqual({ total: 0, completed: 0 });
    expect(harborview).not.toHaveProperty("contractValueAmount");
    expect(list.find((j) => j.id === soloJobId)!.siteContact).toEqual({ name: "Sarah Kim", title: null, phone: "+1 802 555 0199" });
  });

  it("shows my next meeting: one I'm invited to counts, one I declined doesn't", async () => {
    const start = new Date(Date.now() + 2 * 86_400_000);
    const end = new Date(start.getTime() + 3_600_000);
    const [invited, declined, notMine] = await db
      .insert(meetings)
      .values([
        { orgId: ctx.orgId, title: "Progress review", startAt: start, endAt: end, organizerUserId: ownerUserId, location: "220 Ridge Rd" },
        { orgId: ctx.orgId, title: "Declined review", startAt: start, endAt: end, organizerUserId: ownerUserId },
        { orgId: ctx.orgId, title: "Owner only", startAt: start, endAt: end, organizerUserId: ownerUserId, visibility: "org" },
      ])
      .returning();
    await db.insert(meetingAttendees).values([
      { meetingId: invited!.id, userId: ctx.fieldUserId },
      { meetingId: declined!.id, userId: ctx.fieldUserId, status: "declined" },
    ]);
    const res = await fetch(`${testApp.baseUrl}/meetings/upcoming?attending=true&withinDays=7`, { headers: bearer(token) });
    expect(res.status).toBe(200);
    const titles = ((await res.json()) as { id: string; title: string }[]).map((m) => m.title);
    expect(titles).toContain("Progress review");
    expect(titles).not.toContain("Declined review");
    expect(titles).not.toContain(notMine!.title);
  });

  it("gives nobody else's figures: a stranger's session reads its own empty Today", async () => {
    const email = `us-mob-03-stranger-${randomUUID()}@example.com`;
    emails.push(email);
    const stranger = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Stranger" });
    const res = await fetch(`${testApp.baseUrl}/mobile/today?period=month`, { headers: { cookie: stranger.cookie } });
    const body = (await res.json()) as { milestones: { total: number }; expenses: { count: number } };
    expect(body.milestones.total).toBe(0);
    expect(body.expenses.count).toBe(0);
  });
});
