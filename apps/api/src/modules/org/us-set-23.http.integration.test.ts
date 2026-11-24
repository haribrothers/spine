import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { auditLog, expenseCategories, accounts, expenses, member, session as sessionTable } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";

type Who = { cookie: string; userId: string };

/** US-SET-23 — switch optional modules on or off. Requires local Postgres. */
describe("US-SET-23 · switch optional modules on or off (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const fieldUser: Who = { cookie: "", userId: "" };
  const all = { leadsMeetings: true, jobsField: true, approvals: true, recurring: true };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [staff, "staff"], [fieldUser, "field"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `us-set-23-${name}-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    for (const [who, role] of [[staff, "staff"], [fieldUser, "field"]] as const) {
      await db.delete(member).where(eq(member.userId, who.userId));
      await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
      await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    }
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
  });

  it("every module starts on, and any member can read them", async () => {
    expect(await json(await call(owner, "GET", "/org/modules"))).toEqual(all);
    expect(await json(await call(staff, "GET", "/org/modules"))).toEqual(all);
  });

  it("a Staff user can't switch them (403)", async () => {
    expect((await call(staff, "PUT", "/org/modules", { ...all, approvals: false })).status).toBe(403);
  });

  it("Jobs & field can't go off while someone uses the field app; the switch stays on", async () => {
    const res = await call(owner, "PUT", "/org/modules", { ...all, jobsField: false });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("1 person uses the field app. Change their role or deactivate them first.");
    expect(((await json<typeof all>(await call(owner, "GET", "/org/modules"))) as typeof all).jobsField).toBe(true);
  });

  it("with Approvals off, a submitted expense is approved and posted at once, and a big discount needs no approval", async () => {
    await json(await call(owner, "PUT", "/org/modules", { ...all, approvals: false }));
    const audited = await db.select().from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, "modules")));
    expect(audited).toHaveLength(1);
    expect(audited[0]!.changes).toEqual([{ field: "Approvals", from: "On", to: "Off" }]);

    const [other] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "6900")));
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Fuel", accountId: other!.id }).returning();
    const expense = await json<{ id: string; status: string }>(await call(fieldUser, "POST", "/expenses", { categoryId: category!.id, date: "2026-10-01", currency: "USD", amount: "4500" }));
    expect(expense.status).toBe("approved");
    const [row] = await db.select().from(expenses).where(eq(expenses.id, expense.id));
    expect(row!.journalEntryId).not.toBeNull();

    const contact = await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "customer", name: "Lakeview Homes", email: "lakeview@example.com" }));
    const quote = await json<{ id: string; discountRequiresApproval: boolean }>(
      await call(owner, "POST", "/quotes", { contactId: contact.id, currency: "USD", lines: [{ name: "Deck", quantity: 1, unitPriceAmount: "100000", discountPercentage: 40 }] }),
    );
    expect(quote.discountRequiresApproval).toBe(true);
    expect(await json<{ status: string }>(await call(owner, "POST", `/quotes/${quote.id}/send`))).toMatchObject({ status: "sent" });
  });
});
