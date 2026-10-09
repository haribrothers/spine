import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { expenseCategories, expenseLabourLines, expenses, jobAssignments, jobPhotos, milestones, notifications, user } from "../../db/schema";
import { createTestApp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";
import { bearer, bearerSignIn, customerWithJob, ownerWithFieldUser } from "./field-user.test-helper";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

/**
 * Phase 5 Group 4 — what the field app's photo, expense and completion
 * screens send. Requires local Postgres.
 */
describe("Field work from the phone (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let ctx: Awaited<ReturnType<typeof ownerWithFieldUser>>;
  let token: string;
  let jobId: string;
  let otherJobId: string;
  let ownerUserId: string;

  const upload = async () => {
    const form = new FormData();
    form.append("file", new Blob([PNG], { type: "image/jpeg" }), "site.jpg");
    const res = await fetch(`${testApp.baseUrl}/files`, { method: "POST", headers: bearer(token, { "Idempotency-Key": randomUUID() }), body: form });
    return ((await res.json()) as { id: string }).id;
  };
  const post = (path: string, body: unknown, auth: Record<string, string> = bearer(token)) =>
    fetch(`${testApp.baseUrl}${path}`, { method: "POST", headers: { ...auth, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" }, body: JSON.stringify(body) });

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(undefined);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    ctx = await ownerWithFieldUser(testApp.baseUrl, db, emails);
    [{ id: ownerUserId }] = (await db.select({ id: user.id }).from(user).where(eq(user.email, emails[0]!))) as [{ id: string }];
    ({ jobId } = await customerWithJob(db, ctx.orgId));
    otherJobId = (await customerWithJob(db, ctx.orgId)).jobId;
    await db.insert(jobAssignments).values({ jobId, userId: ctx.fieldUserId, orgId: ctx.orgId });
    token = (await bearerSignIn(testApp.baseUrl, ctx.fieldEmail, "testpassword123")).token!;
  }, 60_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  describe("US-MOB-11 · take site photos tagged to a job, even offline", () => {
    it("attaches a photo with its caption and, optionally, the milestone it shows", async () => {
      const [milestone] = await db.insert(milestones).values({ jobId, orgId: ctx.orgId, name: "Mobilisation", sequence: 0 }).returning();
      const fileId = await upload();
      const res = await post(`/jobs/${jobId}/photos`, { fileId, caption: "Site cabin in place", milestoneId: milestone!.id });
      expect(res.status).toBeLessThan(300);
      const [row] = await db.select().from(jobPhotos).where(eq(jobPhotos.fileId, fileId));
      expect(row).toMatchObject({ caption: "Site cabin in place", milestoneId: milestone!.id, uploadedByUserId: ctx.fieldUserId });
    });

    it("refuses a milestone from another job", async () => {
      const [elsewhere] = await db.insert(milestones).values({ jobId: otherJobId, orgId: ctx.orgId, name: "Elsewhere", sequence: 0 }).returning();
      const res = await post(`/jobs/${jobId}/photos`, { fileId: await upload(), milestoneId: elsewhere!.id });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { message: string }).message).toBe("Choose one of this job's milestones.");
    });
  });

  describe("US-MOB-12 · see my expenses and their status", () => {
    it("says who rejected an expense, with my own expenses only", async () => {
      const [category] = await db.insert(expenseCategories).values({ orgId: ctx.orgId, name: `Fuel ${randomUUID()}` }).returning();
      const [mine] = await db.insert(expenses).values({ orgId: ctx.orgId, categoryId: category!.id, date: new Date(), currency: "USD", amount: 3850n, submittedByUserId: ctx.fieldUserId }).returning();
      await db.insert(expenses).values({ orgId: ctx.orgId, categoryId: category!.id, date: new Date(), currency: "USD", amount: 9999n, submittedByUserId: ownerUserId });
      expect((await post(`/expenses/${mine!.id}/reject`, { comment: "No receipt attached" }, { cookie: ctx.ownerCookie })).status).toBeLessThan(300);
      const list = (await (await fetch(`${testApp.baseUrl}/expenses?mine=true`, { headers: bearer(token) })).json()) as { id: string; status: string; reviewComment: string; reviewerName: string | null; submittedByUserId: string }[];
      expect(list.every((e) => e.submittedByUserId === ctx.fieldUserId)).toBe(true);
      expect(list.find((e) => e.id === mine!.id)).toMatchObject({ status: "rejected", reviewComment: "No receipt attached", reviewerName: "Mob Owner" });
    });
  });

  describe("US-MOB-13 · submit an expense with a receipt photo", () => {
    it("suggests Field only the trades and day rates from their own labour expenses", async () => {
      const [labour] = await db.insert(expenseCategories).values({ orgId: ctx.orgId, name: `Labour ${randomUUID()}` }).returning();
      const created = await post("/expenses", {
        categoryId: labour!.id,
        jobId,
        date: "2026-10-08",
        currency: "USD",
        amount: "88000",
        entryMode: "labour",
        labourLines: [{ trade: "Mason", headcount: 4, dayRateAmount: "22000" }],
        receiptFileId: await upload(),
      });
      expect(created.status).toBeLessThan(300);
      const [ownerExpense] = await db.insert(expenses).values({ orgId: ctx.orgId, categoryId: labour!.id, jobId, date: new Date(), currency: "USD", amount: 99000n, submittedByUserId: ownerUserId, entryMode: "labour" }).returning();
      await db.insert(expenseLabourLines).values({ orgId: ctx.orgId, expenseId: ownerExpense!.id, trade: "Crane operator", headcount: 1, dayRateAmount: 99000n, lineAmount: 99000n, sortOrder: 0 });

      const field = (await (await fetch(`${testApp.baseUrl}/expenses/labour-trades`, { headers: bearer(token) })).json()) as { trade: string; lastDayRateAmount: string }[];
      expect(field).toEqual([{ trade: "Mason", lastDayRateAmount: "22000" }]);
      const office = (await (await fetch(`${testApp.baseUrl}/expenses/labour-trades`, { headers: { cookie: ctx.ownerCookie } })).json()) as { trade: string }[];
      expect(office.map((t) => t.trade).sort()).toEqual(["Crane operator", "Mason"]);
    });
  });

  describe("US-MOB-15 · mark a milestone complete from the phone", () => {
    it("completes it with the note and photos, and tells the office once", async () => {
      const [milestone] = await db.insert(milestones).values({ jobId, orgId: ctx.orgId, name: "Mobilisation & site setup", sequence: 1 }).returning();
      const fileId = await upload();
      const first = await post(`/jobs/${jobId}/milestones/${milestone!.id}/complete`, { completionNotes: "Site cabin, fencing and power in place.", photoFileIds: [fileId] });
      expect(first.status).toBeLessThan(300);
      const second = await post(`/jobs/${jobId}/milestones/${milestone!.id}/complete`, { completionNotes: "Again", photoFileIds: [] });
      expect(((await second.json()) as { alreadyCompleted?: boolean }).alreadyCompleted).toBe(true);
      const [row] = await db.select().from(milestones).where(eq(milestones.id, milestone!.id));
      expect(row).toMatchObject({ status: "completed", completionNotes: "Site cabin, fencing and power in place.", completedByUserId: ctx.fieldUserId });
      expect(await db.select().from(jobPhotos).where(and(eq(jobPhotos.fileId, fileId), eq(jobPhotos.milestoneId, milestone!.id)))).toHaveLength(1);
      await vi.waitFor(async () => {
        const told = await db.select().from(notifications).where(and(eq(notifications.orgId, ctx.orgId), eq(notifications.type, "milestone_completed")));
        expect(told.filter((n) => n.message.includes("Mobilisation & site setup"))).toHaveLength(1);
      });
    });
  });
});
