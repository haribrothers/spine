import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createCreditNoteSchema, createInvoiceSchema } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, invoices, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { CreditNotesService } from "../credit-notes/credit-notes.service";
import { InvoicesService } from "../invoices/invoices.service";
import { QueueService } from "../queue/queue.service";

/**
 * US-JOB-27 (D-127) — billed to date against the contract: gross progress
 * invoices from the ledger, less credit notes, without advance or
 * retention-release invoices. Requires local Postgres.
 */
describe("US-JOB-27 · see how much of the contract has been billed (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-job-27-${randomUUID()}@example.com`;
  let cookie: string;
  let orgId: string;
  let userId: string;
  let contactId: string;
  let jobId: string;

  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await res.json()) as Record<string, unknown>;
  };
  const billing = async () => (await call("GET", `/jobs/${jobId}/costing`)).billing;

  /** An issued invoice on the job: `type`, total in minor units, optional retention held. */
  async function issued(type: "progress" | "advance" | "retention_release" | "standard", amount: string, retention = 0n, onJob = jobId) {
    const service = testApp.app.get(InvoicesService);
    const draft = await service.create(orgId, userId, createInvoiceSchema.parse({ contactId, type: type === "retention_release" ? "standard" : type, currency: "USD", lines: [{ name: "Claim", quantity: 1, unitPriceAmount: amount }] }));
    await db.update(invoices).set({ jobId: onJob, type, retentionAmount: retention }).where(eq(invoices.id, draft.id));
    return service.issue(orgId, draft.id, userId);
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    userId = owner.userId;
    orgId = (await db.select().from(member).where(eq(member.userId, userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Harborview Construction Co.", createdByUserId: userId }).returning();
    contactId = contact!.id;
    jobId = (await call("POST", "/jobs", { contactId, name: "Marina office fit-out", currency: "USD", contractValueAmount: "4850000" })).id as string;
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("nothing billed yet: 0%, everything left to bill", async () => {
    expect(await billing()).toEqual({ contractValue: "4850000", billedToDate: "0", billedPct: 0, leftToBill: "4850000", percentComplete: null, gapPts: null });
  });

  it("issued progress invoices count gross (before retention): 19,400.00 is 40%, 29,100.00 left", async () => {
    await issued("progress", "970000", 48500n);
    await issued("progress", "970000");
    expect(await billing()).toEqual({ contractValue: "4850000", billedToDate: "1940000", billedPct: 40, leftToBill: "2910000", percentComplete: null, gapPts: null });
  });

  it("advance and retention-release invoices don't count", async () => {
    await issued("advance", "500000");
    await issued("retention_release", "48500");
    expect(await billing()).toMatchObject({ billedToDate: "1940000" });
  });

  it("a credit note against one of them takes its total off", async () => {
    // The first progress claim, by creation — never "any invoice on the job" (an advance can't be credited).
    const [claim] = await db.select().from(invoices).where(and(eq(invoices.jobId, jobId), eq(invoices.type, "progress"))).orderBy(asc(invoices.createdAt), asc(invoices.id)).limit(1);
    const credit = await testApp.app.get(CreditNotesService).create(orgId, userId, createCreditNoteSchema.parse({ invoiceId: claim!.id, reason: "Rate correction", lines: [{ name: "Correction", quantity: 1, unitPriceAmount: "40000" }] }));
    await testApp.app.get(CreditNotesService).issue(orgId, credit.id, userId);
    expect(await billing()).toMatchObject({ billedToDate: "1900000", billedPct: 39 });
  });

  it("billed past the contract shows a negative amount left (the card says 'Billed over contract by …')", async () => {
    await issued("progress", "3000000");
    expect(await billing()).toMatchObject({ billedToDate: "4900000", billedPct: 101, leftToBill: "-50000" });
  });

  it("the Jobs list adds billed % for job-profitability viewers", async () => {
    const list = (await call("GET", "/jobs?include=costing")) as unknown as { id: string; billedPct: number }[];
    expect(list.find((j) => j.id === jobId)?.billedPct).toBe(101);
  });
});
