import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { contactPersons, jobAssignments, jobs, jobVariationOrders, milestones, quoteLines, quotes, user } from "../../db/schema";
import { createTestApp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";
import { bearer, bearerSignIn, customerWithJob, ownerWithFieldUser } from "./field-user.test-helper";

/**
 * US-MOB-05 — a job on the phone: name, number, customer, site address,
 * who to call, milestones and photos without money, and the quotes to
 * present (`GET /jobs/:id/quotes`, D-073). Requires local Postgres.
 */
describe("US-MOB-05 · open a job's details on site (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let ctx: Awaited<ReturnType<typeof ownerWithFieldUser>>;
  let token: string;
  let jobId: string;
  let contactId: string;
  let otherJobId: string;
  const quoteIds: Record<string, string> = {};

  const get = (path: string) => fetch(`${testApp.baseUrl}${path}`, { headers: bearer(token) });

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(undefined);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    ctx = await ownerWithFieldUser(testApp.baseUrl, db, emails);
    ({ jobId, contactId } = await customerWithJob(db, ctx.orgId, { job: { number: "JOB-001" } }));
    otherJobId = (await customerWithJob(db, ctx.orgId)).jobId;
    await db.insert(contactPersons).values({ contactId, name: "Alan Reyes", title: "Procurement Manager", phone: "+1 207 555 0142", isPrimary: true });
    await db.insert(jobAssignments).values({ jobId, userId: ctx.fieldUserId, orgId: ctx.orgId });
    await db.insert(milestones).values({ jobId, orgId: ctx.orgId, name: "Mobilisation & site setup", sequence: 0, amount: 25, resolvedAmount: 1_200_000n, dueDate: new Date("2026-10-10T00:00:00Z") });

    const quote = async (key: string, status: "draft" | "sent" | "accepted", number: string, line: string, sentAt: Date | null) => {
      const [row] = await db.insert(quotes).values({ orgId: ctx.orgId, contactId, currency: "USD", status, number, sentAt, totalAmount: 120_000n }).returning();
      await db.insert(quoteLines).values({ quoteId: row!.id, sortOrder: 0, name: line, quantity: 1, unitPriceAmount: 120_000n, unitPriceCurrency: "USD" });
      quoteIds[key] = row!.id;
      return row!.id;
    };
    const source = await quote("source", "sent", "QUO-0001", "Marina office fit-out", new Date("2026-09-01T09:00:00Z"));
    await db.update(jobs).set({ sourceQuoteId: source }).where(inArray(jobs.id, [jobId]));
    for (const [key, status, number, line, sentAt] of [
      ["outlets", "sent", "QUO-0004", "Additional electrical outlets", new Date("2026-10-06T09:00:00Z")],
      ["draft", "draft", "QUO-0005", "Not sent yet", null],
      ["accepted", "accepted", "QUO-0003", "Already accepted", new Date("2026-09-20T09:00:00Z")],
    ] as const) {
      await db.insert(jobVariationOrders).values({ jobId, orgId: ctx.orgId, quoteId: await quote(key, status, number, line, sentAt) });
    }
    token = (await bearerSignIn(testApp.baseUrl, ctx.fieldEmail, "testpassword123")).token!;
  }, 60_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  it("opens the job with its number, customer, status, site address and who to call — and no contract value", async () => {
    const res = await get(`/jobs/${jobId}`);
    expect(res.status).toBe(200);
    const job = (await res.json()) as Record<string, unknown>;
    expect(job).toMatchObject({ number: "JOB-001", contactName: "Harborview Construction Co.", status: "active", siteAddress: "48 Harbor Way, Portland, ME 04101" });
    expect(job.siteContact).toEqual({ name: "Alan Reyes", title: "Procurement Manager", phone: "+1 207 555 0142" });
    for (const money of ["contractValueAmount", "retentionPct", "costBudgetAmount"]) expect(job).not.toHaveProperty(money);
  });

  it("lists milestones with due dates and status but no amounts", async () => {
    const list = (await (await get(`/jobs/${jobId}/milestones`)).json()) as Record<string, unknown>[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Mobilisation & site setup", status: "pending" });
    expect(list[0]).not.toHaveProperty("amount");
    expect(list[0]).not.toHaveProperty("resolvedAmount");
  });

  it("lists the quotes to present: sent variation quotes and the sent source quote, newest first, without amounts", async () => {
    const res = await get(`/jobs/${jobId}/quotes`);
    expect(res.status).toBe(200);
    const list = (await res.json()) as Record<string, unknown>[];
    expect(list.map((q) => q.number)).toEqual(["QUO-0004", "QUO-0001"]);
    expect(list[0]).toMatchObject({ id: quoteIds.outlets, kind: "variation", title: "Additional electrical outlets" });
    expect(list[1]).toMatchObject({ id: quoteIds.source, kind: "source", title: "Marina office fit-out" });
    expect(list[0]).not.toHaveProperty("totalAmount");
  });

  it("gives Field nothing on a job they aren't on (404)", async () => {
    expect((await get(`/jobs/${otherJobId}`)).status).toBe(404);
    expect((await get(`/jobs/${otherJobId}/quotes`)).status).toBe(404);
  });

  it("lets the office read a job's quotes to present too", async () => {
    const res = await fetch(`${testApp.baseUrl}/jobs/${jobId}/quotes`, { headers: { cookie: ctx.ownerCookie } });
    expect(res.status).toBe(200);
    expect(((await res.json()) as unknown[]).length).toBe(2);
  });
});
