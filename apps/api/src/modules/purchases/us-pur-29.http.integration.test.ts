import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount, RecurringBill } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { orgClock } from "../../common/org-clock";

type Who = { cookie: string; userId: string };

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** US-PUR-29 (D-159) — set up a recurring bill: name, vendor, lines, repeat, start, end, due, paid from, and record or draft. Requires local Postgres. */
describe("US-PUR-29 · set up a recurring bill (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let vendorId: string;
  let rentAccount: string;
  let bank: MoneyAccount;
  const today = orgClock().date;
  const owner: Who = { cookie: "", userId: "" };
  const clerk: Who = { cookie: "", userId: "" };
  const plain: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;
  const schedule = (overrides: Record<string, unknown> = {}) => ({
    name: "Office rent",
    contactId: vendorId,
    currency: "USD",
    frequency: "monthly",
    dayRule: "1",
    startsOn: today,
    endsOn: null,
    maxCount: null,
    dueDays: 7,
    moneyAccountId: bank.id,
    mode: "record",
    lines: [{ type: "item", name: "Rent", quantity: 1, unitPriceAmount: "240000", accountId: rentAccount }],
    ...overrides,
  });

  async function join(who: Who, role: "staff" | "field", grants: string[] = []) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    if (role !== "staff") return;
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    for (const capability of grants) await db.insert(teamPrivileges).values({ teamId: team!.id, capability, granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [clerk, "clerk"], [plain, "plain"], [field, "field"]] as const) {
      const email = `us-pur-29-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(clerk, "staff", ["vendor_bills.manage_recurring"]);
    await join(plain, "staff", ["vendor_bills.edit_own"]);
    await join(field, "field");
    vendorId = (await db.insert(contacts).values({ orgId, type: "vendor", name: "Harbourside Properties", createdByUserId: owner.userId }).returning())[0]!.id;
    rentAccount = (await db.select().from(accounts).where(eq(accounts.orgId, orgId))).find((a) => a.code === "6000")!.id;
    bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("saves the schedule with its next date, amount, paid-from account and mode; the list shows it Active", async () => {
    const saved = await json<RecurringBill>(await call(owner, "POST", "/recurring-bills", schedule({ startsOn: shift(today, 1), dayRule: "last", frequency: "quarterly", maxCount: 4 })));
    expect(saved).toMatchObject({ name: "Office rent", contactName: "Harbourside Properties", frequency: "quarterly", dayRule: "last", maxCount: 4, dueDays: 7, moneyAccountId: bank.id, mode: "record", status: "active", totalAmount: "240000", createdCount: 0 });
    expect(saved.nextRunOn! > today).toBe(true);
    expect(saved.lines.map((l) => [l.name, l.unitPriceAmount, l.accountId])).toEqual([["Rent", "240000", rentAccount]]);
    const list = await json<RecurringBill[]>(await call(owner, "GET", "/recurring-bills"));
    expect(list.map((s) => [s.name, s.status])).toEqual([["Office rent", "active"]]);
  });

  it("checks the start date, the vendor and an account on every line", async () => {
    expect(await message(await call(owner, "POST", "/recurring-bills", schedule({ startsOn: shift(today, -1) })))).toBe("Pick today or a later start date.");
    expect((await call(owner, "POST", "/recurring-bills", schedule({ contactId: randomUUID() }))).status).toBe(400);
    expect(await message(await call(owner, "POST", "/recurring-bills", schedule({ lines: [{ type: "item", name: "Rent", quantity: 1, unitPriceAmount: "100" }] })))).toBe("Choose an expense account on every line.");
    expect(await message(await call(owner, "POST", "/recurring-bills", schedule({ lines: [] })))).toBe("Add at least one line.");
  });

  it("needs 'Manage recurring bills': granted Staff can, others and Field can't", async () => {
    expect((await call(clerk, "GET", "/recurring-bills")).status).toBe(200);
    await json(await call(clerk, "POST", "/recurring-bills", schedule({ name: "Software subscription", mode: "draft" })));
    for (const who of [plain, field]) {
      expect((await call(who, "GET", "/recurring-bills")).status).toBe(403);
      expect((await call(who, "POST", "/recurring-bills", schedule())).status).toBe(403);
    }
  });
});
