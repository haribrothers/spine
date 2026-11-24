import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { occurrenceAfter, type RecurringBill } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, member, recurringBills, user, vendorBillLines, vendorBills } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { orgClock } from "../../common/org-clock";
import { RecurringBillRunService } from "./recurring-bill-run.service";

const at = (date: string, time = "07:00") => new Date(`${date}T${time}:00Z`);

/** US-PUR-31 — pause, resume, edit and delete a recurring bill; bills already created are untouched. Requires local Postgres. */
describe("US-PUR-31 · pause, edit or stop a recurring bill (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-pur-31-${randomUUID()}@example.com`;
  let cookie: string;
  let orgId: string;
  let vendorId: string;
  let rentAccount: string;
  let run: RecurringBillRunService;
  let scheduleId: string;
  const tz = process.env.TZ;
  const today = orgClock().date;

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const body = (amount: string) => ({
    name: "Office rent",
    contactId: vendorId,
    currency: "USD",
    frequency: "monthly",
    dayRule: "1",
    startsOn: today,
    dueDays: 7,
    mode: "record",
    lines: [{ type: "item", name: "Rent", quantity: 1, unitPriceAmount: amount, accountId: rentAccount }],
  });
  const made = () => db.select().from(vendorBills).where(eq(vendorBills.recurringBillId, scheduleId));

  beforeAll(async () => {
    process.env.TZ = "UTC";
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    vendorId = (await db.insert(contacts).values({ orgId, type: "vendor", name: "Harbourside Properties", createdByUserId: owner.userId }).returning())[0]!.id;
    rentAccount = (await db.select().from(accounts).where(eq(accounts.orgId, orgId))).find((a) => a.code === "6000")!.id;
    run = testApp.app.get(RecurringBillRunService);
    scheduleId = (await json<RecurringBill>(await call("POST", "/recurring-bills", body("240000")))).id;
    // As if it started on Sep 1, with Sep's bill already made.
    await db.update(recurringBills).set({ startsOn: "2026-09-01", nextRunOn: "2026-09-01" }).where(eq(recurringBills.id, scheduleId));
    await run.runDue(at("2026-09-01"));
  }, 120_000);

  afterAll(async () => {
    process.env.TZ = tz;
    await testApp?.close();
    await db.delete(user).where(eq(user.email, email));
  });

  it("Pause: nothing is created until Resume, which moves the next date to the next future occurrence", async () => {
    const paused = await json<RecurringBill>(await call("POST", `/recurring-bills/${scheduleId}/pause`));
    expect([paused.status, paused.nextRunOn]).toEqual(["paused", null]);
    await run.runDue(at("2026-10-15"));
    expect(await made()).toHaveLength(1);
    expect((await call("POST", `/recurring-bills/${scheduleId}/pause`)).status).toBe(400);

    const resumed = await json<RecurringBill>(await call("POST", `/recurring-bills/${scheduleId}/resume`));
    expect(resumed.status).toBe("active");
    expect(resumed.nextRunOn).toBe(occurrenceAfter({ frequency: "monthly", dayRule: "1", startsOn: "2026-09-01" }, today));
    expect(resumed.nextRunOn! > today).toBe(true);
  });

  it("editing lines or amounts leaves bills already created unchanged", async () => {
    const [before] = await made();
    const edited = await json<RecurringBill>(await call("PUT", `/recurring-bills/${scheduleId}`, { ...body("260000"), startsOn: "2026-09-01" }));
    expect(edited.totalAmount).toBe("260000");
    const [after] = await made();
    expect(after!.totalAmount).toBe(before!.totalAmount);
    expect((await db.select().from(vendorBillLines).where(eq(vendorBillLines.billId, after!.id)))[0]!.unitPriceAmount).toBe(240000n);
  });

  it("Delete: the schedule goes, its bills stay", async () => {
    const [bill] = await made();
    await json(await call("DELETE", `/recurring-bills/${scheduleId}`));
    expect((await call("GET", `/recurring-bills/${scheduleId}`)).status).toBe(404);
    const [kept] = await db.select().from(vendorBills).where(eq(vendorBills.id, bill!.id));
    expect(kept).toMatchObject({ status: "recorded", recurringBillId: null });
  });
});
