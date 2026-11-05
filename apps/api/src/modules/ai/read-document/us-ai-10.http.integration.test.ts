import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AiStatus, ReceiptSuggestion } from "@spine/shared";
import { createDb, type Database } from "../../../db/client";
import { accounts, aiRequests, expenseCategories, expenses, jobAssignments, user } from "../../../db/schema";
import { createTestApp, type TestApp } from "../../../test-utils/test-app";
import { startAiStub, type AiStub } from "../../../test-utils/ai-stub";
import { billPhoto } from "../../../test-utils/bill-documents";
import { QueueService } from "../../queue/queue.service";
import { bearer, bearerSignIn, customerWithJob, ownerWithFieldUser } from "../../mobile/field-user.test-helper";

/**
 * US-AI-10 — the phone's half: a Field user, signed in with a bearer token
 * as the field app is, uploads a receipt photo, has AI read it, and queues
 * the expense with that file and the AI mark. Requires local Postgres.
 */
describe("US-AI-10 · read my receipt on the phone (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let stub: AiStub;
  let token: string;
  let categoryId: string;
  const emails: string[] = [];
  let ctx: Awaited<ReturnType<typeof ownerWithFieldUser>>;

  const phone = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { ...bearer(token), "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, body: body === undefined ? undefined : JSON.stringify(body) });
  const owner = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { cookie: ctx.ownerCookie, "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  /** The outbox's upload: multipart, bearer, an Idempotency-Key per photo. */
  const uploadPhoto = async () => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(billPhoto())], { type: "image/png" }), "receipt.jpg");
    return (await json<{ id: string }>(await fetch(`${testApp.baseUrl}/files`, { method: "POST", headers: bearer(token, { "Idempotency-Key": randomUUID() }), body: form }))).id;
  };
  const expense = (extra: Record<string, unknown>) => ({ categoryId, jobId: null, date: "2026-10-08", currency: "USD", amount: "6420", description: "Shell Harbor Rd — diesel, 15.2 gal", paidBy: "employee", ...extra });

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    ctx = await ownerWithFieldUser(testApp.baseUrl, db, emails);
    token = (await bearerSignIn(testApp.baseUrl, ctx.fieldEmail, "testpassword123")).token!;
    const [other] = await db.select().from(accounts).where(and(eq(accounts.orgId, ctx.orgId), eq(accounts.code, "6900")));
    categoryId = (await db.insert(expenseCategories).values({ orgId: ctx.orgId, name: "Fuel & Vehicle", description: "Diesel and petrol", accountId: other!.id }).returning())[0]!.id;
    stub = await startAiStub();
    await json(await owner("PUT", "/org/ai", { driver: "openai-compatible", baseUrl: stub.url, model: "qwen3-vl:8b", enabled: true }));
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await stub?.close();
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  it("the phone learns it may read its own receipt, and that AI is off when it is", async () => {
    const modules = await json<Record<string, unknown>>(await phone("GET", "/org/modules"));
    expect(modules.ai).toBe(true);
    expect(await json<AiStatus>(await phone("GET", "/ai/status"))).toMatchObject({ canUse: false, canReadOwnReceipt: true, features: { readDocuments: true } });

    await json(await owner("PUT", "/org/ai", { enabled: false }));
    expect((await phone("GET", "/ai/status")).status).toBe(403);
    expect(await json<Record<string, unknown>>(await phone("GET", "/org/modules"))).not.toHaveProperty("ai");
    await json(await owner("PUT", "/org/ai", { enabled: true }));
  });

  it("a Field user's photo is read without the Team right, and the queued expense uses that file and says it was filled in with AI", async () => {
    stub.setReply(JSON.stringify({ merchant: "Shell Harbor Rd", whatWasBought: "diesel, 15.2 gal", date: "2026-10-08", currency: "USD", total: "64.20", category: "Fuel & Vehicle" }));
    const fileId = await uploadPhoto();
    const suggestion = await json<ReceiptSuggestion>(await phone("POST", "/ai/read-document", { fileId, target: "expense" }));
    expect(suggestion).toMatchObject({ amount: "6420", date: "2026-10-08", categoryId, description: "Shell Harbor Rd — diesel, 15.2 gal", readAsImages: true });

    // What the outbox sends: the file AI read, not a second upload, and the AI mark.
    const created = await json<{ id: string; receiptFileId: string; aiAssisted: boolean }>(await phone("POST", "/expenses", expense({ receiptFileId: fileId, aiAssisted: true })));
    expect(created).toMatchObject({ receiptFileId: fileId, aiAssisted: true });
    const activity = await json<{ type: string; aiAssisted?: true }[]>(await phone("GET", `/expenses/${created.id}/activity`));
    expect(activity.find((e) => e.type === "submitted")).toMatchObject({ aiAssisted: true });
    const [request] = await db.select().from(aiRequests).where(and(eq(aiRequests.orgId, ctx.orgId), eq(aiRequests.userId, ctx.fieldUserId)));
    expect(request).toMatchObject({ feature: "read_document", outcome: "ok" });
  });

  it("an expense filled in by hand syncs as before: no AI request, no AI mark", async () => {
    const before = (await db.select().from(aiRequests).where(eq(aiRequests.orgId, ctx.orgId))).length;
    const created = await json<{ id: string }>(await phone("POST", "/expenses", expense({ receiptFileId: await uploadPhoto() })));
    const [row] = await db.select().from(expenses).where(eq(expenses.id, created.id));
    expect(row!.aiAssisted).toBe(false);
    expect((await db.select().from(aiRequests).where(eq(aiRequests.orgId, ctx.orgId))).length).toBe(before);
  });

  it("the phone can read only its own photos", async () => {
    // A photo the owner uploaded isn't Marcus's to read, nor to use as his receipt (D-250).
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(billPhoto())], { type: "image/png" }), "receipt.jpg");
    const ownersFile = (await json<{ id: string }>(await fetch(`${testApp.baseUrl}/files`, { method: "POST", headers: { cookie: ctx.ownerCookie, "Idempotency-Key": randomUUID() }, body: form }))).id;
    expect((await phone("POST", "/ai/read-document", { fileId: ownersFile, target: "expense" })).status).toBe(404);
    expect((await phone("POST", "/expenses", expense({ receiptFileId: ownersFile }))).status).toBe(400);
    // Nor one of his photos that another record now uses — a job photo isn't a fresh receipt (D-250).
    const { jobId } = await customerWithJob(db, ctx.orgId);
    await db.insert(jobAssignments).values({ jobId, userId: ctx.fieldUserId, orgId: ctx.orgId });
    const sitePhoto = await uploadPhoto();
    await json(await phone("POST", `/jobs/${jobId}/photos`, { fileId: sitePhoto }));
    expect((await phone("POST", "/ai/read-document", { fileId: sitePhoto, target: "expense" })).status).toBe(404);
    // Nor a vendor bill: Field never reads bills.
    expect((await phone("POST", "/ai/read-document", { fileId: await uploadPhoto(), target: "vendor_bill" })).status).toBe(403);
  });
});
