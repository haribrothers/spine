import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { JobActivityEntry } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { files, member, quotes, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";

interface JobRow {
  id: string;
  number: string | null;
  sourceQuoteNumber?: string | null;
  contractValueAmount?: string;
  billedAmount?: string;
  billedPct?: number | null;
  readyToBillCount?: number;
  readyToBillAmount?: string;
  retentionHeld?: string;
}

/**
 * US-JOB-30, US-JOB-31, US-JOB-34, US-JOB-36 and US-JOB-37 (D-215) — the
 * API side of jobs you can run from one place: a job started from the
 * list, billing figures per job, the source quote's number, who added each
 * photo, and the job's activity. Requires local Postgres.
 */
describe("Jobs you can run from one place (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-job-30-${randomUUID()}@example.com`;
  const fieldEmail = `us-job-30-field-${randomUUID()}@example.com`;
  let cookie: string;
  let fieldCookie: string;
  let ownerId: string;
  let fieldUserId: string;
  let orgId: string;
  let contactId: string;
  let jobId: string;
  let milestoneIds: string[];

  const call = (method: string, route: string, body?: unknown, who = cookie) =>
    fetch(`${testApp.baseUrl}${route}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => (await res.json()) as T;
  const listed = async (who = cookie) => (await json<JobRow[]>(await call("GET", "/jobs?include=billing", undefined, who))).find((j) => j.id === jobId)!;
  const activity = async (id = jobId) => json<JobActivityEntry[]>(await call("GET", `/jobs/${id}/activity`));

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(undefined);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Priya Raman" });
    cookie = owner.cookie;
    ownerId = owner.userId;
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    contactId = (await json<{ id: string }>(await call("POST", "/contacts", { type: "customer", name: "Sahyadri Retail Pvt Ltd" }))).id;
    const field = await signUp(testApp.baseUrl, { email: fieldEmail, password: "testpassword123", name: "Ravi Kumar" });
    fieldCookie = field.cookie;
    fieldUserId = field.userId;
    await db.delete(member).where(eq(member.userId, field.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.userId, role: "field", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, field.userId));
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email, fieldEmail]));
  });

  describe("US-JOB-30 · start a job from the jobs list", () => {
    it("refuses an end date before the start date, with what to do", async () => {
      const res = await call("POST", "/jobs", { contactId, name: "Warehouse extension", currency: "USD", startDate: "2026-11-30", endDate: "2026-10-01" });
      expect(res.status).toBe(400);
      expect((await json<{ message: string }>(res)).message).toBe("End the job on or after its start date.");
    });

    it("creates a job without a quote, numbered, with no source quote", async () => {
      const res = await call("POST", "/jobs", { contactId, name: "Warehouse extension", siteAddress: "Baner Road, Pune 411045", currency: "USD", contractValueAmount: "1000000", retentionPct: 5, startDate: "2026-10-01", endDate: "2026-11-30" });
      expect(res.status).toBe(201);
      const job = await json<JobRow>(res);
      jobId = job.id;
      expect(job.number).toMatch(/^JOB-\d+$/);
      expect(job.sourceQuoteNumber).toBeNull();
    });
  });

  describe("US-JOB-31 · ready to bill and retention held", () => {
    it("counts completed, not invoiced milestones and their amount", async () => {
      const set = await json<{ id: string }[]>(
        await call("PUT", `/jobs/${jobId}/milestones`, {
          milestones: [
            { name: "Site preparation", sequence: 0, amountType: "percent", amount: 30, dueDate: "2026-10-15" },
            { name: "Steel structure", sequence: 1, amountType: "percent", amount: 40, dueDate: "2026-11-01" },
            { name: "Roofing & handover", sequence: 2, amountType: "percent", amount: 30, dueDate: "2026-11-30" },
          ],
        }),
      );
      milestoneIds = set.map((m) => m.id);
      expect(await listed()).toMatchObject({ billedAmount: "0", billedPct: 0, readyToBillCount: 0, readyToBillAmount: "0", retentionHeld: "0" });

      expect((await call("POST", `/jobs/${jobId}/milestones/${milestoneIds[0]}/complete`, {})).status).toBe(201);
      expect(await listed()).toMatchObject({ readyToBillCount: 1, readyToBillAmount: "300000" });
    });

    it("holds retention on 1150 once the milestone's invoice is issued, and it's no longer ready to bill", async () => {
      const draft = await json<{ id: string }>(await call("POST", `/jobs/${jobId}/milestones/${milestoneIds[0]}/invoice`));
      expect((await call("POST", `/invoices/${draft.id}/issue`)).status).toBe(201);
      expect(await listed()).toMatchObject({ billedAmount: "300000", billedPct: 30, readyToBillCount: 0, readyToBillAmount: "0", retentionHeld: "15000" });
    });

    it("gives Field no billing figures, even when asked", async () => {
      await call("POST", `/jobs/${jobId}/assignees`, { userId: fieldUserId });
      const row = await listed(fieldCookie);
      for (const key of ["billedAmount", "billedPct", "readyToBillCount", "readyToBillAmount", "retentionHeld", "contractValueAmount"]) expect(row).not.toHaveProperty(key);
    });
  });

  describe("US-JOB-34 · the job page's figures", () => {
    it("adds the billing figures to one job, for Owners and Staff only", async () => {
      expect(await json<JobRow>(await call("GET", `/jobs/${jobId}?include=billing`))).toMatchObject({ contractValueAmount: "1000000", billedAmount: "300000", retentionHeld: "15000" });
      const asField = await json<JobRow>(await call("GET", `/jobs/${jobId}?include=billing`, undefined, fieldCookie));
      expect(asField).not.toHaveProperty("billedAmount");
      expect(asField).not.toHaveProperty("contractValueAmount");
    });

    it("names the quote a job came from", async () => {
      const quote = await json<{ id: string; number: string }>(await call("POST", "/quotes", { contactId, currency: "USD", lines: [{ type: "item", name: "Bathroom refit", quantity: 1, unitPriceAmount: "224790" }] }));
      await call("POST", `/quotes/${quote.id}/send`, {});
      await db.update(quotes).set({ status: "accepted", respondedAt: new Date() }).where(eq(quotes.id, quote.id));
      const [sent] = await db.select({ number: quotes.number }).from(quotes).where(eq(quotes.id, quote.id));
      const job = await json<JobRow>(await call("POST", `/jobs/from-quote/${quote.id}`, {}));
      expect((await json<JobRow>(await call("GET", `/jobs/${job.id}`))).sourceQuoteNumber).toBe(sent!.number);
      const [created] = await activity(job.id);
      expect(created).toMatchObject({ type: "created_from_quote", actorName: "Priya Raman", detail: sent!.number, linkId: quote.id });
    });
  });

  describe("US-JOB-36 · photos say who added them", () => {
    it("lists each photo with its uploader's name", async () => {
      const [file] = await db.insert(files).values({ orgId, key: `test/${randomUUID()}.jpg`, originalFilename: "gate-north.jpg", mimeType: "image/jpeg", sizeBytes: 1024, uploadedByUserId: ownerId }).returning();
      expect((await call("POST", `/jobs/${jobId}/photos`, { fileId: file!.id, caption: "Gate, north side", milestoneId: milestoneIds[0] })).status).toBe(201);
      const photos = await json<{ caption: string; uploadedByName: string | null; milestoneId: string | null }[]>(await call("GET", `/jobs/${jobId}/photos`));
      expect(photos[0]).toMatchObject({ caption: "Gate, north side", uploadedByName: "Priya Raman", milestoneId: milestoneIds[0] });
    });
  });

  describe("US-JOB-37 · follow what happened on a job", () => {
    it("tells the job's story newest first, with who and what", async () => {
      await call("PUT", `/jobs/${jobId}`, { status: "on_hold" });
      await call("POST", `/jobs/${jobId}/notes`, { body: "Client away 20–27 Oct." });
      const entries = await activity();
      const types = entries.map((e) => e.type);
      expect(types[0]).toBe("note_added");
      expect(types[1]).toBe("status_changed");
      expect(entries[1]).toMatchObject({ detail: "on_hold", actorName: "Priya Raman" });
      expect(types.at(-1)).toBe("created");
      for (const t of ["milestones_set", "milestone_completed", "milestone_invoiced", "photo_added", "crew_assigned"]) expect(types).toContain(t);
      expect(entries.find((e) => e.type === "milestone_completed")?.detail).toBe("Site preparation");
      expect(entries.find((e) => e.type === "milestone_invoiced")?.detail).toMatch(/^Site preparation · INV-/);
      expect(entries.find((e) => e.type === "photo_added")?.detail).toBe("Site preparation");
      expect(entries.find((e) => e.type === "crew_assigned")?.detail).toBe("Ravi Kumar");
      expect([...entries].sort((a, b) => b.at.localeCompare(a.at))).toEqual(entries);
    });

    it("is not for Field users", async () => {
      expect((await call("GET", `/jobs/${jobId}/activity`, undefined, fieldCookie)).status).toBe(403);
    });
  });
});
