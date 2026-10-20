import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const PORT = vi.hoisted(() => {
  const port = 4780 + Number(process.env.VITEST_POOL_ID ?? 0);
  process.env.API_URL = `http://localhost:${port}`;
  return port;
});

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { TestAgent, connectAgent } from "../../test-utils/agent-client";

type Who = { cookie: string; userId: string };
type Text = { content: { type: string; text: string }[]; isError?: boolean };
const parse = (r: unknown) => JSON.parse((r as Text).content[0]!.text) as Record<string, unknown>;
const REPORT_TOOLS = ["receivables", "payables", "profit_and_loss", "balance_sheet", "job_profitability", "bank_balances", "dashboard_summary"];

/** Drops the `…Formatted` copies and the wrapper the tools add, to compare with the report route itself. */
function raw(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(raw);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([k]) => !k.endsWith("Formatted") && k !== "report" && k !== "link").map(([k, v]) => [k, raw(v)]));
}

/** US-MCP-06 (D-259) — reports for agents: the report's own figures, only for those who may read it. Requires local Postgres. */
describe("US-MCP-06 · ask an agent who owes us and how the business is doing (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  const base = `http://localhost:${PORT}`;
  const agents: Record<"owner" | "staff" | "field", Client> = {} as never;

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const toolNames = async (c: Client) => (await c.listTools()).tools.map((t) => t.name);

  beforeAll(async () => {
    testApp = await createTestApp({ port: PORT });
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "Priya Raman"], [staff, "Kavya Iyer"], [field, "Marcus Webb"]] as const) {
      Object.assign(who, await signUp(base, { email: `us-mcp-06-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    for (const [who, role] of [[staff, "staff"], [field, "field"]] as const) {
      await db.delete(member).where(eq(member.userId, who.userId));
      await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
      await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    }
    // Kavya's Team reads receivables and nothing else money-wise.
    const teamId = (await json<{ id: string; isDefault: boolean }[]>(await call(owner, "GET", "/org/teams"))).find((t) => t.isDefault)!.id;
    const staffMember = (await db.select().from(member).where(eq(member.userId, staff.userId)))[0]!;
    await json(await call(owner, "PUT", `/org/teams/${teamId}/members`, { memberIds: [staffMember.id] }));
    const off = ["reports.view_payables", "reports.view_financial_statements", "reports.view_job_profitability", "banking.view", "reports.view_dashboard_summary"].map((capability) => ({ capability, granted: false }));
    await json(await call(owner, "PUT", `/org/teams/${teamId}/privileges`, { privileges: [{ capability: "reports.view_receivables", granted: true }, ...off] }));

    const contactId = (await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "customer", name: "Harbour Road Residences" }))).id;
    const draft = await json<{ id: string }>(await call(owner, "POST", "/invoices", { contactId, currency: "USD", issueDate: "2026-08-01", dueDate: "2026-08-15", lines: [{ name: "Deck repair", quantity: 1, unitPriceAmount: "125000" }] }));
    await json(await call(owner, "POST", `/invoices/${draft.id}/issue`));

    expect((await call(owner, "PUT", "/org/agents", { enabled: true })).status).toBe(200);
    agents.owner = await connectAgent(base, owner.cookie, new TestAgent("Owner Agent"));
    agents.staff = await connectAgent(base, staff.cookie, new TestAgent("Staff Agent"));
    agents.field = await connectAgent(base, field.cookie, new TestAgent("Field Agent"));
  }, 180_000);

  afterAll(async () => {
    for (const c of Object.values(agents)) await c?.close();
    await testApp?.close();
  });

  it("an Owner's agent gets every report tool, each read-only", async () => {
    const tools = (await agents.owner.listTools()).tools;
    for (const name of REPORT_TOOLS) expect(tools.find((t) => t.name === name)?.annotations?.readOnlyHint).toBe(true);
  });

  it("receivables are exactly the Receivables report's, with amounts formatted and a link", async () => {
    const result = parse(await agents.owner.callTool({ name: "receivables", arguments: { age: "overdue" } }));
    const report = await json(await call(owner, "GET", "/reports/receivables?age=overdue"));
    expect(raw(result)).toEqual(raw(report));
    expect(JSON.stringify(result)).toContain("$1,250.00");
    expect(result.link).toMatch(/\/receivables$/);
  });

  it("profit and loss and the balance sheet are the reports' own, for the period asked", async () => {
    const pl = parse(await agents.owner.callTool({ name: "profit_and_loss", arguments: { from: "2026-08-01", to: "2026-08-31", basis: "accrual" } }));
    expect(raw(pl)).toEqual(raw(await json(await call(owner, "GET", "/reports/profit-and-loss?from=2026-08-01&to=2026-08-31&basis=accrual"))));
    const bs = parse(await agents.owner.callTool({ name: "balance_sheet", arguments: { asOf: "2026-08-31" } }));
    expect(raw(bs)).toEqual(raw(await json(await call(owner, "GET", "/reports/balance-sheet?asOf=2026-08-31"))));
    const bad = (await agents.owner.callTool({ name: "profit_and_loss", arguments: { from: "2026-09-01", to: "2026-08-01" } })) as Text;
    expect(bad.isError).toBe(true);
    expect(bad.content[0]!.text).toBe("Choose a From date on or before the To date.");
  });

  it("Staff get only the reports their Teams open; Field gets no money tools at all", async () => {
    const staffTools = await toolNames(agents.staff);
    expect(staffTools.filter((t) => REPORT_TOOLS.includes(t))).toEqual(["receivables"]);
    expect(await toolNames(agents.field)).not.toEqual(expect.arrayContaining(["receivables"]));
    expect((await toolNames(agents.field)).filter((t) => REPORT_TOOLS.includes(t))).toEqual([]);
    await expect(agents.staff.callTool({ name: "payables", arguments: {} })).resolves.toMatchObject({ isError: true });
  });
});
