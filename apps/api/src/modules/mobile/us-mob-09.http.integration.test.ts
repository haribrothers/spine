import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { expenseCategories, expenses, files, jobAssignments, jobPhotos, milestones, user } from "../../db/schema";
import { createTestApp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";
import { bearer, bearerSignIn, customerWithJob, ownerWithFieldUser } from "./field-user.test-helper";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

/**
 * US-MOB-09 (D-009) — the phone's outbox retries a step whose answer was
 * lost with the same `Idempotency-Key`: the server returns the first
 * result and creates nothing twice. A milestone someone already completed
 * answers 201, as any completion, with `alreadyCompleted` and who did it (first write wins, US-MOB-15).
 * Uploads over 10 MB are refused (D-053). Requires local Postgres.
 */
describe("US-MOB-09 · send each item exactly once and fix failures (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let ctx: Awaited<ReturnType<typeof ownerWithFieldUser>>;
  let token: string;
  let jobId: string;

  const upload = (key: string, bytes: Buffer = PNG) => {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "image/jpeg" }), "site.jpg");
    return fetch(`${testApp.baseUrl}/files`, { method: "POST", headers: bearer(token, { "Idempotency-Key": key }), body: form });
  };
  const post = (path: string, key: string, body: unknown, auth: Record<string, string> = bearer(token)) =>
    fetch(`${testApp.baseUrl}${path}`, { method: "POST", headers: { ...auth, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify(body) });

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    ctx = await ownerWithFieldUser(testApp.baseUrl, db, emails);
    ({ jobId } = await customerWithJob(db, ctx.orgId));
    await db.insert(jobAssignments).values({ jobId, userId: ctx.fieldUserId, orgId: ctx.orgId });
    token = (await bearerSignIn(testApp.baseUrl, ctx.fieldEmail, "testpassword123")).token!;
  }, 60_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  it("uploads a photo once, however many times the same step is retried", async () => {
    const key = `${randomUUID()}:file:0`;
    const first = await upload(key);
    expect(first.status).toBeLessThan(300);
    const { id } = (await first.json()) as { id: string };
    const again = await upload(key);
    expect(((await again.json()) as { id: string }).id).toBe(id);
    expect(await db.select().from(files).where(eq(files.orgId, ctx.orgId))).toHaveLength(1);
  });

  it("attaches a site photo once when the attach is retried", async () => {
    const item = randomUUID();
    const { id: fileId } = (await (await upload(`${item}:file:0`)).json()) as { id: string };
    const a = (await (await post(`/jobs/${jobId}/photos`, `${item}:photo:0`, { fileId })).json()) as { id: string };
    const b = (await (await post(`/jobs/${jobId}/photos`, `${item}:photo:0`, { fileId })).json()) as { id: string };
    expect(b.id).toBe(a.id);
    expect(await db.select().from(jobPhotos).where(eq(jobPhotos.fileId, fileId))).toHaveLength(1);
  });

  it("creates an expense once when it's retried", async () => {
    const [category] = await db.insert(expenseCategories).values({ orgId: ctx.orgId, name: `Fuel ${randomUUID()}` }).returning();
    const key = randomUUID();
    const body = { categoryId: category!.id, jobId, date: "2026-10-08", currency: "USD", amount: "6420", paidBy: "employee", description: "Van fuel" };
    const a = await post("/expenses", key, body);
    expect(a.status).toBeLessThan(300);
    const first = (await a.json()) as { id: string };
    const second = (await (await post("/expenses", key, body)).json()) as { id: string };
    expect(second.id).toBe(first.id);
    expect(await db.select().from(expenses).where(eq(expenses.categoryId, category!.id))).toHaveLength(1);
  });

  it("answers a completion that arrives after someone else's with alreadyCompleted and who, and keeps its photos", async () => {
    const [milestone] = await db.insert(milestones).values({ jobId, orgId: ctx.orgId, name: "Foundation walls poured", sequence: 0 }).returning();
    const first = await post(`/jobs/${jobId}/milestones/${milestone!.id}/complete`, randomUUID(), { completionNotes: null, photoFileIds: [] }, { cookie: ctx.ownerCookie });
    expect(first.status).toBeLessThan(300);
    const { id: fileId } = (await (await upload(`${randomUUID()}:file:0`)).json()) as { id: string };
    const late = await post(`/jobs/${jobId}/milestones/${milestone!.id}/complete`, randomUUID(), { completionNotes: "Done", photoFileIds: [fileId] });
    expect(late.status).toBe(201);
    const body = (await late.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ status: "completed", alreadyCompleted: true, completedBy: { name: "Mob Owner" } });
    expect(body).not.toHaveProperty("amount");
    const [row] = await db.select().from(milestones).where(eq(milestones.id, milestone!.id));
    expect(row!.completionNotes).toBeNull();
    expect(await db.select().from(jobPhotos).where(eq(jobPhotos.fileId, fileId))).toHaveLength(1);
  });

  it("refuses an upload over 10 MB, saying what to do", async () => {
    const res = await upload(randomUUID(), Buffer.alloc(10 * 1024 * 1024 + 1));
    expect(res.status).toBe(413);
    expect(((await res.json()) as { message: string }).message).toBe("This file is over 10 MB. Upload a smaller copy, or split the PDF.");
  });
});
