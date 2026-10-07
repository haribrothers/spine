import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TallyMappingRow } from "@spine/shared";
import { createDb, type Database } from "../../../db/client";
import { member, session as sessionTable, teamMemberships, teamPrivileges, teams } from "../../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-RPT-39 — each account's Tally group: defaults by type and code, and an Owner's changes. Requires local Postgres. */
describe("US-RPT-39 · map my accounts to Tally groups (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const accountant: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const rows = async (who: Who = owner) => {
    const res = await call(who, "GET", "/exports/tally/mapping");
    expect(res.status, await res.clone().text()).toBe(200);
    return (await res.json()) as TallyMappingRow[];
  };
  const byCode = (list: TallyMappingRow[], code: string) => list.find((r) => r.code === code)!;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [accountant, "accountant"], [field, "field"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `us-rpt-39-${name}-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    for (const [who, role] of [[accountant, "staff"], [field, "field"]] as const) {
      await db.delete(member).where(eq(member.userId, who.userId));
      const memberId = randomUUID();
      await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
      await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
      if (role === "staff") {
        const [team] = await db.insert(teams).values({ orgId, name: `Accountants ${randomUUID()}` }).returning();
        await db.insert(teamPrivileges).values({ teamId: team!.id, capability: "reports.view_financial_statements", granted: true });
        await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
      }
    }
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("pre-maps every account by type and code the first time", async () => {
    const list = await rows();
    expect(list.every((r) => r.isDefault)).toBe(true);
    const expected: Record<string, string> = {
      "1000": "Cash-in-Hand",
      "1010": "Bank Accounts",
      "1200": "Duties & Taxes",
      "1500": "Fixed Assets",
      "2100": "Duties & Taxes",
      "2500": "Loans (Liability)",
      "3000": "Capital Account",
      "4100": "Sales Accounts",
      "5000": "Direct Expenses",
      "6000": "Indirect Expenses",
    };
    for (const [code, group] of Object.entries(expected)) expect(byCode(list, code), code).toMatchObject({ tallyGroup: group, isDefault: true });
    expect(byCode(list, "1000")).toMatchObject({ name: "Cash in Hand", type: "asset" });
  });

  it("an Owner's change is saved and used from then on", async () => {
    const rent = byCode(await rows(), "6000");
    const res = await call(owner, "PUT", "/exports/tally/mapping", { mappings: [{ accountId: rent.accountId, tallyGroup: "Direct Expenses" }] });
    expect(res.status).toBe(200);
    const after = await rows();
    expect(byCode(after, "6000")).toMatchObject({ tallyGroup: "Direct Expenses", isDefault: false });
    expect(byCode(after, "6100")).toMatchObject({ tallyGroup: "Indirect Expenses", isDefault: true });
  });

  it("refuses a group Tally doesn't have, and an account from another organisation", async () => {
    const rent = byCode(await rows(), "6000");
    const bad = await call(owner, "PUT", "/exports/tally/mapping", { mappings: [{ accountId: rent.accountId, tallyGroup: "Rent" }] });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { message: string }).message).toBe("Choose one of Tally's groups.");
    const foreign = await call(owner, "PUT", "/exports/tally/mapping", { mappings: [{ accountId: randomUUID(), tallyGroup: "Direct Expenses" }] });
    expect(foreign.status).toBe(400);
    expect(((await foreign.json()) as { message: string }).message).toBe("That account isn't in your chart of accounts.");
  });

  it("an accountant with 'View financial statements' can read the mapping but not change it; Field can't read it", async () => {
    const list = await rows(accountant);
    expect(list.length).toBeGreaterThan(20);
    const res = await call(accountant, "PUT", "/exports/tally/mapping", { mappings: [{ accountId: byCode(list, "6000").accountId, tallyGroup: "Indirect Expenses" }] });
    expect(res.status).toBe(403);
    expect((await call(field, "GET", "/exports/tally/mapping")).status).toBe(403);
  });
});
