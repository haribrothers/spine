import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createInvoiceSchema } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, invoices, jobAssignments, member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { InvoicesService } from "../invoices/invoices.service";
import { QueueService } from "../queue/queue.service";

type Who = { cookie: string; userId: string };

/**
 * US-JOB-28 (D-127) — a job's percent complete: 0–100, beside billed % on
 * the Costing tab, visible to Field (it isn't money). Requires local
 * Postgres.
 */
describe("US-JOB-28 · record how complete a job is and compare it with billing (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let jobId: string;
  const owner: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = async (who: Who, method: string, path: string, body?: unknown) => {
    const res = await fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  };

  async function newUser(name: string): Promise<Who> {
    const email = `us-job-28-${name}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(undefined);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Harborview Construction Co.", createdByUserId: owner.userId }).returning();
    jobId = (await call(owner, "POST", "/jobs", { contactId: contact!.id, name: "Marina office fit-out", currency: "USD", contractValueAmount: "4850000" })).json.id as string;
    // 40% billed.
    const service = testApp.app.get(InvoicesService);
    const draft = await service.create(orgId, owner.userId, createInvoiceSchema.parse({ contactId: contact!.id, currency: "USD", lines: [{ name: "Claim", quantity: 1, unitPriceAmount: "1940000" }] }));
    await db.update(invoices).set({ jobId, type: "progress" }).where(eq(invoices.id, draft.id));
    await service.issue(orgId, draft.id, owner.userId);

    Object.assign(field, await newUser("field"));
    await db.delete(member).where(eq(member.userId, field.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.userId, role: "field", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, field.userId));
    await db.insert(jobAssignments).values({ jobId, userId: field.userId, orgId });
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("55% complete and 40% billed: the billing is 15 points behind", async () => {
    expect((await call(owner, "PUT", `/jobs/${jobId}`, { percentComplete: 55 })).status).toBeLessThan(300);
    expect((await call(owner, "GET", `/jobs/${jobId}/costing`)).json.billing).toMatchObject({ billedPct: 40, percentComplete: 55, gapPts: -15 });
  });

  it("120 or a negative number is refused: 'Enter a percentage from 0 to 100.'", async () => {
    for (const bad of [120, -5]) {
      const res = await call(owner, "PUT", `/jobs/${jobId}`, { percentComplete: bad });
      expect(res.status).toBe(400);
      expect(res.json.message).toBe("Enter a percentage from 0 to 100.");
    }
    expect((await call(owner, "GET", `/jobs/${jobId}`)).json.percentComplete).toBe(55);
  });

  it("marking the job Completed leaves percent complete alone", async () => {
    await call(owner, "PUT", `/jobs/${jobId}`, { status: "completed" });
    expect((await call(owner, "GET", `/jobs/${jobId}`)).json.percentComplete).toBe(55);
  });

  it("Field users get percent complete, but not the billing comparison", async () => {
    const job = await call(field, "GET", `/jobs/${jobId}`);
    expect(job.json.percentComplete).toBe(55);
    expect(job.json).not.toHaveProperty("contractValueAmount");
    expect((await call(field, "GET", `/jobs/${jobId}/costing`)).status).toBe(403);
  });

  it("clearing it removes the comparison", async () => {
    await call(owner, "PUT", `/jobs/${jobId}`, { percentComplete: null });
    expect((await call(owner, "GET", `/jobs/${jobId}/costing`)).json.billing).toMatchObject({ percentComplete: null, gapPts: null });
  });
});
