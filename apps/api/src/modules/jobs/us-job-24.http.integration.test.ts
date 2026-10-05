import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createVariationOrderSchema } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, jobAssignments, member, quotes, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { VariationOrdersService } from "./variation-orders.service";

type Who = { cookie: string; userId: string };

/**
 * US-JOB-24 (D-125) — a job's optional cost budget: saved and audited,
 * never negative, clearable, hidden from Field, untouched by variation
 * orders. Requires local Postgres.
 */
describe("US-JOB-24 · set a cost budget for a job (requires local Postgres)", () => {
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
    const email = `us-job-24-${name}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Harborview Construction Co.", createdByUserId: owner.userId }).returning();
    const created = await call(owner, "POST", "/jobs", { contactId: contact!.id, name: "Marina office fit-out", currency: "USD", contractValueAmount: "4850000" });
    expect(created.status).toBeLessThan(300);
    jobId = created.json.id as string;

    Object.assign(field, await newUser("field"));
    await db.delete(member).where(eq(member.userId, field.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.userId, role: "field", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, field.userId));
    await db.insert(jobAssignments).values({ jobId, userId: field.userId, orgId });
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("a job starts with no budget; saving 32,000.00 stores it and the history records the change", async () => {
    expect((await call(owner, "GET", `/jobs/${jobId}`)).json.costBudgetAmount).toBeNull();
    const saved = await call(owner, "PUT", `/jobs/${jobId}`, { costBudgetAmount: "3200000" });
    expect(saved.status).toBeLessThan(300);
    expect((await call(owner, "GET", `/jobs/${jobId}`)).json.costBudgetAmount).toBe("3200000");
    const history = (await call(owner, "GET", `/jobs/${jobId}/history`)).json as unknown as { actorUserId: string; changes: { field: string; from: unknown; to: unknown }[] }[];
    expect(history).toEqual(expect.arrayContaining([expect.objectContaining({ actorUserId: owner.userId, changes: [{ field: "costBudgetAmount", from: null, to: "3200000" }] })]));
  });

  it("a negative budget is refused: 'Enter a budget of zero or more.'", async () => {
    const res = await call(owner, "PUT", `/jobs/${jobId}`, { costBudgetAmount: "-100" });
    expect(res.status).toBe(400);
    expect(res.json.message).toBe("Enter a budget of zero or more.");
    expect((await call(owner, "GET", `/jobs/${jobId}`)).json.costBudgetAmount).toBe("3200000");
  });

  it("applying a variation order raises the contract value but leaves the budget alone", async () => {
    const service = testApp.app.get(VariationOrdersService);
    const list = await service.create(orgId, owner.userId, jobId, createVariationOrderSchema.parse({ lines: [{ name: "Extra partition wall", quantity: 1, unitPriceAmount: "250000" }] }));
    const vo = list.at(-1)!;
    await db.update(quotes).set({ status: "accepted" }).where(eq(quotes.id, vo.quote.id));
    await service.apply(orgId, owner.userId, jobId, vo.id);
    const job = (await call(owner, "GET", `/jobs/${jobId}`)).json;
    expect(job.contractValueAmount).toBe("5100000");
    expect(job.costBudgetAmount).toBe("3200000");
  });

  it("Field users never get the budget", async () => {
    const job = await call(field, "GET", `/jobs/${jobId}`);
    expect(job.status).toBe(200);
    expect(job.json).not.toHaveProperty("costBudgetAmount");
    const list = (await call(field, "GET", "/jobs")).json as unknown as Record<string, unknown>[];
    expect(list[0]).not.toHaveProperty("costBudgetAmount");
  });

  it("clearing the field removes the budget", async () => {
    await call(owner, "PUT", `/jobs/${jobId}`, { costBudgetAmount: null });
    expect((await call(owner, "GET", `/jobs/${jobId}`)).json.costBudgetAmount).toBeNull();
  });
});
