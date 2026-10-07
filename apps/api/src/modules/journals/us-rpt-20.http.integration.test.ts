import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ManualJournal } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, journalEntries, journalLines, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-RPT-20 — post an adjusting journal: balanced, no control accounts, never in a closed period; Owner only. Requires local Postgres. */
describe("US-RPT-20 · post an adjusting journal (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let code: Record<string, string>;
  let jobId: string;
  const owner: Who = { cookie: "", userId: "" };
  const viewer: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;
  const journal = (lines: [string, string, string, string?][], date = "2026-09-30", reason = "Depreciation for September") => ({
    date,
    reason,
    lines: lines.map(([c, debit, credit, job]) => ({ accountId: code[c], description: "Vehicles — September", debit, credit, jobId: job ?? null })),
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
    for (const [who, name] of [[owner, "owner"], [viewer, "viewer"], [field, "field"]] as const) {
      const email = `us-rpt-20-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(viewer, "staff", ["ledger.view"]);
    await join(field, "field");
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const customer = await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "customer", name: "Harbour Lofts" }));
    jobId = (await json<{ id: string }>(await call(owner, "POST", "/jobs", { contactId: customer.id, name: "Harbour Lofts fit-out", currency: "USD" }))).id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("a balanced journal gets JNL-0001 and posts P21 as entered (job-tagged), with source Journal", async () => {
    const posted = await json<ManualJournal>(await call(owner, "POST", "/manual-journals", journal([["6900", "40000", "0", jobId], ["1510", "0", "40000"]])));
    expect(posted).toMatchObject({ number: "JNL-0001", date: "2026-09-30", reason: "Depreciation for September", status: "posted", total: "40000", postedBy: { name: "owner" }, reversal: null });
    expect(posted.lines!.map((l) => [l.account.code, l.description, l.debit, l.credit, l.job?.id ?? null])).toEqual([
      ["6900", "Vehicles — September", "40000", "0", jobId],
      ["1510", "Vehicles — September", "0", "40000", null],
    ]);
    const [entry] = await db.select().from(journalEntries).where(and(eq(journalEntries.sourceType, "manual_journal"), eq(journalEntries.sourceId, posted.id)));
    expect(entry).toMatchObject({ date: "2026-09-30", narration: "Journal JNL-0001 — Depreciation for September" });
    const lines = await db.select().from(journalLines).where(eq(journalLines.entryId, entry!.id));
    expect(lines.find((l) => l.accountId === code["6900"])!.jobId).toBe(jobId);
    // Retained Earnings is allowed (year-end entries).
    expect((await json<ManualJournal>(await call(owner, "POST", "/manual-journals", journal([["3200", "1000", "0"], ["3000", "0", "1000"]])))).number).toBe("JNL-0002");
  });

  it("refuses a journal that doesn't balance", async () => {
    const res = await call(owner, "POST", "/manual-journals", journal([["6900", "160000", "0"], ["2400", "0", "155000"]]));
    expect(res.status).toBe(400);
    expect(await message(res)).toBe("Debits and credits must be equal — out by $50.00.");
  });

  it("refuses control accounts", async () => {
    const cases: [string, string][] = [
      ["1100", "Accounts Receivable"],
      ["1150", "Retention Receivable"],
      ["1200", "Input Tax Receivable"],
      ["2000", "Accounts Payable"],
      ["2100", "Output Tax Payable"],
      ["2200", "Customer Advances"],
      ["3900", "Opening Balance Adjustments"],
    ];
    for (const [c, name] of cases) {
      const res = await call(owner, "POST", "/manual-journals", journal([[c, "100", "0"], ["3000", "0", "100"]]));
      expect(await message(res)).toBe(`Use invoices, bills, payments or Record tax payment to change ${name}.`);
    }
  });

  it("refuses a date inside a closed period", async () => {
    const period = await json<{ id: string }>(await call(owner, "POST", "/org/fiscal-periods", { startDate: "2026-01-01", endDate: "2026-03-31" }));
    await json(await call(owner, "POST", `/org/fiscal-periods/${period.id}/close`));
    const res = await call(owner, "POST", "/manual-journals", journal([["6900", "100", "0"], ["1510", "0", "100"]], "2026-03-31"));
    expect(res.status).toBe(400);
    expect(await message(res)).toMatch(/falls within a closed fiscal period/);
  });

  it("Owner only: Staff, even with ledger.view, and Field get 403", async () => {
    for (const who of [viewer, field]) expect((await call(who, "POST", "/manual-journals", journal([["6900", "100", "0"], ["1510", "0", "100"]]))).status).toBe(403);
  });
});
