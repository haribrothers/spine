import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { occurrenceAfter } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, invoiceLines, invoices, member, recurringInvoices, user } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";
import { RecurringInvoiceRunService } from "./recurring-invoice-run.service";

/**
 * US-INV-22 — pausing, resuming, editing and deleting a recurring invoice.
 * Requires local Postgres.
 */
describe("US-INV-22 · pause, edit or stop a recurring invoice (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-inv-22-${randomUUID()}@example.com`;
  let cookie: string;
  let orgId: string;
  let contactId: string;
  let run: RecurringInvoiceRunService;
  const today = orgClock().date;

  const body = (overrides: Record<string, unknown> = {}) => ({
    name: `Site security retainer ${randomUUID().slice(0, 4)}`,
    contactId,
    currency: "USD",
    frequency: "monthly",
    dayRule: "last",
    startsOn: today,
    dueDays: 14,
    mode: "draft",
    lines: [{ type: "item", name: "Security patrols", quantity: 1, unitPriceAmount: "80000" }],
    ...overrides,
  });
  const call = async (method: string, path: string, data?: unknown) => {
    const res = await fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> & { message?: string } };
  };
  const create = async (overrides: Record<string, unknown> = {}) => (await call("POST", "/recurring-invoices", body(overrides))).json as { id: string; name: string };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    contactId = contact!.id;
    run = testApp.app.get(RecurringInvoiceRunService);
  }, 120_000);

  beforeEach(() => {
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(undefined);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("the list shows name, customer, repeats, next invoice, amount, status and when it runs", async () => {
    const s = await create();
    const list = (await call("GET", "/recurring-invoices")).json as unknown as Record<string, unknown>[];
    expect(list.find((r) => r.id === s.id)).toMatchObject({
      name: s.name,
      contactName: "Maple Ridge Developments",
      frequency: "monthly",
      dayRule: "last",
      totalAmount: "80000",
      status: "active",
      mode: "draft",
      nextRunOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it("a paused schedule creates nothing when its date passes, and its next date is empty", async () => {
    const s = await create();
    const paused = await call("POST", `/recurring-invoices/${s.id}/pause`);
    expect(paused.status).toBeLessThan(300);
    expect(paused.json).toMatchObject({ status: "paused", nextRunOn: null });
    // Even with a date in the past, the run skips it.
    await db.update(recurringInvoices).set({ nextRunOn: "2026-01-31" }).where(eq(recurringInvoices.id, s.id));
    await run.runDue(new Date());
    expect(await db.select().from(invoices).where(eq(invoices.recurringInvoiceId, s.id))).toHaveLength(0);
  });

  it("resuming sets the next date to the next future occurrence; missed ones aren't back-filled", async () => {
    const s = await create({ startsOn: today });
    await call("POST", `/recurring-invoices/${s.id}/pause`);
    const resumed = await call("POST", `/recurring-invoices/${s.id}/resume`);
    expect(resumed.status).toBeLessThan(300);
    expect(resumed.json).toMatchObject({ status: "active", nextRunOn: occurrenceAfter({ frequency: "monthly", dayRule: "last", startsOn: today }, today) });
    expect(await db.select().from(invoices).where(eq(invoices.recurringInvoiceId, s.id))).toHaveLength(0);
    expect((await call("POST", `/recurring-invoices/${s.id}/resume`)).json.message).toBe("Only a paused schedule can be resumed.");
  });

  it("editing lines or amount changes only future invoices", async () => {
    const s = await create();
    await db.update(recurringInvoices).set({ nextRunOn: today }).where(eq(recurringInvoices.id, s.id));
    const [row] = await db.select().from(recurringInvoices).where(eq(recurringInvoices.id, s.id));
    await run.runSchedule(row!, today);
    const [first] = await db.select().from(invoices).where(eq(invoices.recurringInvoiceId, s.id));

    const edited = await call("PUT", `/recurring-invoices/${s.id}`, body({ name: s.name, lines: [{ type: "item", name: "Security patrols (nights)", quantity: 2, unitPriceAmount: "50000" }] }));
    expect(edited.status).toBeLessThan(300);
    expect(edited.json).toMatchObject({ totalAmount: "100000" });
    const [kept] = await db.select().from(invoices).where(eq(invoices.id, first!.id));
    expect(kept!.totalAmount).toBe(80000n);
    expect((await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, first!.id))).map((l) => l.name)).toEqual(["Security patrols"]);
  });

  it("deleting a schedule removes it and keeps the invoices it created", async () => {
    const s = await create();
    await db.update(recurringInvoices).set({ nextRunOn: today }).where(eq(recurringInvoices.id, s.id));
    const [row] = await db.select().from(recurringInvoices).where(eq(recurringInvoices.id, s.id));
    const invoiceId = await run.runSchedule(row!, today);
    expect((await call("DELETE", `/recurring-invoices/${s.id}`)).status).toBeLessThan(300);
    expect(await db.select().from(recurringInvoices).where(eq(recurringInvoices.id, s.id))).toHaveLength(0);
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId!));
    expect(invoice).toMatchObject({ recurringInvoiceId: null, status: "draft" });
    expect((await call("GET", `/recurring-invoices/${s.id}`)).status).toBe(404);
  });
});
