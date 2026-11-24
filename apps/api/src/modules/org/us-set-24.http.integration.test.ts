import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { orgClock } from "../../common/org-clock";
import { createDb, type Database } from "../../db/client";
import { accounts, expenseCategories, invoices, member, recurringInvoices } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { RecurringInvoiceRunService } from "../invoices/recurring-invoice-run.service";
import { QueueService } from "../queue/queue.service";

const all = { leadsMeetings: true, jobsField: true, approvals: true, recurring: true };

/** US-SET-24 and US-SET-25 — a switched-off module leaves no trace, and comes back with nothing lost. Requires local Postgres. */
describe("US-SET-24 / US-SET-25 · hide a switched-off module, and switch it back on (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let cookie = "";
  let jobId = "";
  let scheduleId = "";
  let contactId = "";

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const modules = (m: Partial<typeof all>) => call("PUT", "/org/modules", { ...all, ...m }).then((r) => json<typeof all & { notice?: string }>(r));
  const refused = async (path: string, message: string) => {
    const res = await call("GET", path);
    expect(res.status, path).toBe(403);
    expect(await res.json()).toMatchObject({ statusCode: 403, error: "MODULE_OFF", message });
  };

  beforeAll(async () => {
    process.env.TZ = "UTC";
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email: `us-set-24-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
    contactId = (await json<{ id: string }>(await call("POST", "/contacts", { type: "customer", name: "Harbour Café", email: "harbour@example.com" }))).id;
    jobId = (await json<{ id: string }>(await call("POST", "/jobs", { name: "Kitchen refit Harbour", contactId, currency: "USD" }))).id;
    const schedule = await json<{ id: string }>(
      await call("POST", "/recurring-invoices", {
        name: "Monthly maintenance",
        contactId,
        currency: "USD",
        frequency: "monthly",
        dayRule: "1",
        startsOn: orgClock().date,
        dueDays: 14,
        mode: "draft",
        lines: [{ type: "item", name: "Visit", quantity: 1, unitPriceAmount: "10000" }],
      }),
    );
    scheduleId = schedule.id;
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
  });

  it("an API call to a switched-off module answers 403 MODULE_OFF with what to do", async () => {
    await modules({ leadsMeetings: false, jobsField: false });
    await refused("/leads", "Leads & meetings is switched off. An owner can switch it on in Settings › Modules.");
    await refused("/meetings/upcoming", "Leads & meetings is switched off. An owner can switch it on in Settings › Modules.");
    await refused(`/jobs/${jobId}`, "Jobs & field is switched off. An owner can switch it on in Settings › Modules.");
    await refused("/reports/job-profitability", "Jobs & field is switched off. An owner can switch it on in Settings › Modules.");
    // Everything else still answers.
    expect((await call("GET", "/contacts")).status).toBe(200);
    expect((await call("GET", "/invoices")).status).toBe(200);
  });

  it("its capabilities read as off (Team grants are kept), and search has no Jobs group", async () => {
    const caps = await json<Record<string, boolean>>(await call("GET", "/org/members/me/capabilities"));
    expect(caps["milestones.invoice"]).toBe(false);
    expect(caps["leads.edit_own"]).toBe(false);
    expect(caps["invoices.issue"]).toBe(true);
    const search = await json<{ groups: { type: string }[] }>(await call("GET", "/search?q=Harbour"));
    expect(search.groups.map((g) => g.type)).toContain("contacts");
    expect(search.groups.map((g) => g.type)).not.toContain("jobs");
  });

  it("with Approvals off, the approval attention row is gone", async () => {
    await modules({ leadsMeetings: false, jobsField: false, approvals: false });
    const rows = await json<{ kind: string }[]>(await call("GET", "/dashboard/attention"));
    expect(rows.map((r) => r.kind)).not.toContain("expenses_awaiting_approval");
  });

  it("with Recurring documents off, the scheduled run creates nothing", async () => {
    await modules({ recurring: false });
    const today = orgClock().date;
    await db.update(recurringInvoices).set({ nextRunOn: "2026-02-01" }).where(eq(recurringInvoices.id, scheduleId));
    await testApp.app.get(RecurringInvoiceRunService).runDue(new Date(`${today}T10:00:00Z`));
    expect(await db.select().from(invoices).where(eq(invoices.recurringInvoiceId, scheduleId))).toHaveLength(0);
    await refused("/recurring-invoices", "Recurring documents is switched off. An owner can switch it on in Settings › Modules.");
  });

  it("US-SET-25: switched back on, everything is where it was; schedules resume from the next future date and missed dates are skipped", async () => {
    const result = await modules({});
    const today = orgClock().date;
    expect(result.notice).toMatch(/^Recurring documents were off from .+ to .+; missed dates were skipped\.$/);
    const [schedule] = await db.select().from(recurringInvoices).where(eq(recurringInvoices.id, scheduleId));
    expect(schedule!.nextRunOn! >= today).toBe(true);
    expect(schedule!.nextRunOn!.slice(8)).toBe("01");
    await testApp.app.get(RecurringInvoiceRunService).runDue(new Date(`${today}T10:00:00Z`));
    // Nothing back-filled for the months it was off.
    expect((await db.select().from(invoices).where(eq(invoices.recurringInvoiceId, scheduleId))).length).toBeLessThanOrEqual(1);
    expect(await json<{ id: string; name: string }>(await call("GET", `/jobs/${jobId}`))).toMatchObject({ id: jobId, name: "Kitchen refit Harbour" });
    expect((await json<Record<string, boolean>>(await call("GET", "/org/members/me/capabilities")))["milestones.invoice"]).toBe(true);
  });

  it("US-SET-25: with Approvals back on, new expenses wait; ones approved while it was off stay approved", async () => {
    const [other] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "6900")));
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Fuel", accountId: other!.id }).returning();
    await modules({ approvals: false });
    const whileOff = await json<{ id: string; status: string }>(await call("POST", "/expenses", { categoryId: category!.id, date: "2026-10-01", currency: "USD", amount: "4500" }));
    expect(whileOff.status).toBe("approved");
    await modules({});
    const after = await json<{ id: string; status: string }>(await call("POST", "/expenses", { categoryId: category!.id, date: "2026-10-02", currency: "USD", amount: "3000" }));
    expect(after.status).toBe("submitted");
    expect((await json<{ status: string }>(await call("GET", `/expenses/${whileOff.id}`))).status).toBe("approved");
  });
});
