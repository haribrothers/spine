import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ManualJournal } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-RPT-22 — the journals list: newest first; readable by an Owner or with ledger.view, by nobody else. Requires local Postgres. */
describe("US-RPT-22 · see every manual journal (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let code: Record<string, string>;
  const owner: Who = { cookie: "", userId: "" };
  const reader: Who = { cookie: "", userId: "" };
  const other: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };

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
    for (const [who, name] of [[owner, "owner"], [reader, "reader"], [other, "other"], [field, "field"]] as const) {
      const email = `us-rpt-22-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(reader, "staff", ["ledger.view"]);
    await join(other, "staff", ["reports.view_receivables"]);
    await join(field, "field");
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    for (const [date, reason, amount] of [["2026-06-30", "Year-end accruals (from accountant)", "482000"], ["2026-09-30", "Depreciation for September", "105000"]] as const) {
      await json(await call(owner, "POST", "/manual-journals", { date, reason, lines: [{ accountId: code["6900"], debit: amount, credit: "0" }, { accountId: code["1510"], debit: "0", credit: amount }] }));
    }
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("lists every journal newest first with number, date, reason, total, status and who posted it", async () => {
    const list = await json<ManualJournal[]>(await call(owner, "GET", "/manual-journals"));
    expect(list.map((j) => [j.number, j.date, j.reason, j.total, j.status, j.postedBy?.name])).toEqual([
      ["JNL-0002", "2026-09-30", "Depreciation for September", "105000", "posted", "owner"],
      ["JNL-0001", "2026-06-30", "Year-end accruals (from accountant)", "482000", "posted", "owner"],
    ]);
  });

  it("a member with ledger.view can read the list and a journal, but not post", async () => {
    const list = await json<ManualJournal[]>(await call(reader, "GET", "/manual-journals"));
    expect(list).toHaveLength(2);
    const one = await json<ManualJournal>(await call(reader, "GET", `/manual-journals/${list[0]!.id}`));
    expect(one.lines).toHaveLength(2);
    expect((await call(reader, "POST", "/manual-journals", { date: "2026-09-30", reason: "x", lines: [] })).status).toBe(403);
  });

  it("Staff without ledger.view, and Field, get 403", async () => {
    for (const who of [other, field]) {
      expect((await call(who, "GET", "/manual-journals")).status).toBe(403);
    }
  });
});
