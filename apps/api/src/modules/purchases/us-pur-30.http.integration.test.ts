import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, journalEntries, member, notifications, recurringBills, user, vendorBillLines, vendorBills } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { orgClock } from "../../common/org-clock";
import { RecurringBillRunService } from "./recurring-bill-run.service";

const at = (date: string, time = "07:00") => new Date(`${date}T${time}:00Z`);

/**
 * US-PUR-30 (D-159) — the 6:00 AM run: each due date gets one bill, recorded
 * (P11) or left as a draft with an Owner notification; never twice; missed
 * dates created once each, in order; the schedule finishes at its end.
 * Requires local Postgres.
 */
describe("US-PUR-30 · create recurring bills automatically (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-pur-30-${randomUUID()}@example.com`;
  let cookie: string;
  let orgId: string;
  let ownerId: string;
  let vendorId: string;
  let rentAccount: string;
  let run: RecurringBillRunService;
  const tz = process.env.TZ;

  async function schedule(overrides: Record<string, unknown>, nextRunOn: string) {
    const res = await fetch(`${testApp.baseUrl}/recurring-bills`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: JSON.stringify({
        name: `Office rent ${randomUUID().slice(0, 4)}`,
        contactId: vendorId,
        currency: "USD",
        frequency: "monthly",
        dayRule: "1",
        startsOn: orgClock().date,
        dueDays: 7,
        mode: "record",
        lines: [{ type: "item", name: "Rent", quantity: 1, unitPriceAmount: "240000", accountId: rentAccount }],
        ...overrides,
      }),
    });
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    const saved = (await res.json()) as { id: string; name: string };
    // Started on that date, as if it had been set up then.
    await db.update(recurringBills).set({ nextRunOn, startsOn: nextRunOn }).where(eq(recurringBills.id, saved.id));
    return saved;
  }
  const made = (scheduleId: string) => db.select().from(vendorBills).where(eq(vendorBills.recurringBillId, scheduleId)).orderBy(asc(vendorBills.recurringRunOn));
  const reload = async (scheduleId: string) => (await db.select().from(recurringBills).where(eq(recurringBills.id, scheduleId)))[0]!;

  beforeAll(async () => {
    process.env.TZ = "UTC";
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    ownerId = owner.userId;
    orgId = (await db.select().from(member).where(eq(member.userId, ownerId)))[0]!.organizationId;
    vendorId = (await db.insert(contacts).values({ orgId, type: "vendor", name: "Harbourside Properties", createdByUserId: ownerId }).returning())[0]!.id;
    rentAccount = (await db.select().from(accounts).where(eq(accounts.orgId, orgId))).find((a) => a.code === "6000")!.id;
    run = testApp.app.get(RecurringBillRunService);
  }, 120_000);

  afterAll(async () => {
    process.env.TZ = tz;
    await testApp?.close();
    await db.delete(user).where(eq(user.email, email));
  });

  it("on the day, from 6:00 AM: one recorded bill with the day's date, the lines, the due date and 'Created by Recurring bill <name>'", async () => {
    const s = await schedule({}, "2026-11-01");
    expect((await run.runDue(at("2026-11-01", "05:45"))).created).toEqual([]);
    await run.runDue(at("2026-11-01"));
    const [bill] = await made(s.id);
    expect(bill).toMatchObject({ status: "recorded", recurringRunOn: "2026-11-01", notes: `Created by Recurring bill ${s.name}`, totalAmount: 240000n });
    expect(bill!.date.toISOString().slice(0, 10)).toBe("2026-11-01");
    expect(bill!.dueDate!.toISOString().slice(0, 10)).toBe("2026-11-08");
    expect((await db.select().from(vendorBillLines).where(eq(vendorBillLines.billId, bill!.id))).map((l) => [l.name, l.accountId])).toEqual([["Rent", rentAccount]]);
    // P11 posted at once.
    expect(await db.select().from(journalEntries).where(and(eq(journalEntries.sourceType, "vendor_bill"), eq(journalEntries.sourceId, bill!.id)))).toHaveLength(1);
    expect((await reload(s.id)).nextRunOn).toBe("2026-12-01");

    // A second run the same day makes nothing more.
    await db.update(recurringBills).set({ nextRunOn: "2026-11-01" }).where(eq(recurringBills.id, s.id));
    await run.runDue(at("2026-11-01", "09:00"));
    expect(await made(s.id)).toHaveLength(1);
  });

  it("'Save as a draft' leaves a draft and tells Owners 'Recurring bill ready to review: <name>'", async () => {
    const s = await schedule({ mode: "draft" }, "2026-11-01");
    await run.runDue(at("2026-11-01"));
    const [bill] = await made(s.id);
    expect(bill!.status).toBe("draft");
    await vi.waitFor(async () => {
      const rows = await db.select().from(notifications).where(and(eq(notifications.orgId, orgId), eq(notifications.recipientUserId, ownerId)));
      expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ type: "recurring_bill_draft", message: `Recurring bill ready to review: ${s.name}`, link: `/vendor-bills/${bill!.id}` })]));
    });
  });

  it("after the server was down, missed dates are created once each, in order", async () => {
    const s = await schedule({}, "2026-08-01");
    await run.runDue(at("2026-10-15"));
    expect((await made(s.id)).map((b) => b.recurringRunOn)).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]);
    const after = await reload(s.id);
    expect([after.nextRunOn, after.createdCount, after.status]).toEqual(["2026-11-01", 3, "active"]);
  });

  it("finishes once the end condition is met", async () => {
    const s = await schedule({ maxCount: 2 }, "2026-09-01");
    await run.runDue(at("2026-10-15"));
    expect(await made(s.id)).toHaveLength(2);
    const after = await reload(s.id);
    expect([after.status, after.nextRunOn, after.createdCount]).toEqual(["finished", null, 2]);
  });
});
