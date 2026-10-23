import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const PORT = vi.hoisted(() => {
  const port = 4840 + Number(process.env.VITEST_POOL_ID ?? 0);
  process.env.API_URL = `http://localhost:${port}`;
  return port;
});

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { TestAgent, connectAgent } from "../../test-utils/agent-client";

type Who = { cookie: string; userId: string };
const ALL_TOOLS = ["search", "list_records", "get_record", "receivables", "payables", "profit_and_loss", "balance_sheet", "job_profitability", "bank_balances", "dashboard_summary", "create_lead", "draft_quote", "draft_vendor_bill", "add_note"];

/** US-MCP-09 (D-259) — ready-made tasks, offered per the person's tools and naming only those tools. Requires local Postgres. */
describe("US-MCP-09 · start from a ready-made task (requires local Postgres)", () => {
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
  const promptNames = async (c: Client) => (await c.listPrompts()).prompts.map((p) => p.name);
  const promptText = async (c: Client, name: string, args?: Record<string, string>) => {
    const { messages } = await c.getPrompt({ name, arguments: args });
    return messages.map((m) => (m.content as { text: string }).text).join("\n");
  };
  /** The tools a prompt's text tells the agent to use must all be tools this person was offered. */
  const expectOnlyOfferedTools = async (c: Client, text: string) => {
    const offered = (await c.listTools()).tools.map((t) => t.name);
    const named = ALL_TOOLS.filter((t) => new RegExp(`\\b${t}\\b`).test(text));
    expect(named.length).toBeGreaterThan(0);
    expect(offered).toEqual(expect.arrayContaining(named));
  };

  beforeAll(async () => {
    testApp = await createTestApp({ port: PORT });
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "Priya Raman"], [staff, "Kavya Iyer"], [field, "Marcus Webb"]] as const) {
      Object.assign(who, await signUp(base, { email: `us-mcp-09-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    for (const [who, role] of [[staff, "staff"], [field, "field"]] as const) {
      await db.delete(member).where(eq(member.userId, who.userId));
      await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
      await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    }
    // Kavya's Team reads no money reports.
    const teamId = (await json<{ id: string; isDefault: boolean }[]>(await call(owner, "GET", "/org/teams"))).find((t) => t.isDefault)!.id;
    const staffMember = (await db.select().from(member).where(eq(member.userId, staff.userId)))[0]!;
    await json(await call(owner, "PUT", `/org/teams/${teamId}/members`, { memberIds: [staffMember.id] }));
    const off = ["reports.view_receivables", "reports.view_payables", "reports.view_financial_statements", "reports.view_job_profitability", "banking.view", "reports.view_dashboard_summary"];
    await json(await call(owner, "PUT", `/org/teams/${teamId}/privileges`, { privileges: off.map((capability) => ({ capability, granted: false })) }));

    expect((await call(owner, "PUT", "/org/agents", { enabled: true })).status).toBe(200);
    agents.owner = await connectAgent(base, owner.cookie, new TestAgent("Owner Agent"));
    agents.staff = await connectAgent(base, staff.cookie, new TestAgent("Staff Agent"));
    agents.field = await connectAgent(base, field.cookie, new TestAgent("Field Agent"));
  }, 180_000);

  afterAll(async () => {
    for (const c of Object.values(agents)) await c?.close();
    await testApp?.close();
  });

  it("an Owner's agent offers all three ready-made tasks by name", async () => {
    const { prompts } = await agents.owner.listPrompts();
    expect(prompts.map((p) => p.title)).toEqual(["Chase overdue invoices", "Summarise a job", "This week in the business"]);
    expect(prompts.find((p) => p.name === "summarise_a_job")!.arguments).toEqual([expect.objectContaining({ name: "job", required: true })]);
  });

  it("\"Chase overdue invoices\" reads receivables and drafts nothing: it suggests what to send, for the person to send from Spine", async () => {
    const text = await promptText(agents.owner, "chase_overdue_invoices");
    expect(text).toContain("receivables tool with age \"overdue\"");
    expect(text).toContain("Don't draft or send anything: I'll send reminders from Spine.");
    expect(text).not.toMatch(/draft_quote|create_lead|add_note|draft_vendor_bill/);
    await expectOnlyOfferedTools(agents.owner, text);
  });

  it("\"Summarise a job\" and \"This week in the business\" use only the tools offered, as the person", async () => {
    const job = await promptText(agents.owner, "summarise_a_job", { job: "JOB-0004" });
    expect(job).toContain('Summarise the job "JOB-0004"');
    expect(job).toContain("job_profitability");
    await expectOnlyOfferedTools(agents.owner, job);
    const week = await promptText(agents.owner, "this_week_in_the_business");
    expect(week).toContain("dashboard_summary");
    await expectOnlyOfferedTools(agents.owner, week);
  });

  it("Staff without money reports and Field aren't offered chasing, and their tasks name none of those reports", async () => {
    for (const c of [agents.staff, agents.field]) {
      expect(await promptNames(c)).toEqual(["summarise_a_job", "this_week_in_the_business"]);
      for (const name of ["summarise_a_job", "this_week_in_the_business"]) {
        const text = await promptText(c, name, name === "summarise_a_job" ? { job: "Harbour Road deck" } : undefined);
        expect(text).not.toMatch(/receivables|payables|job_profitability|dashboard_summary|bank_balances/);
        await expectOnlyOfferedTools(c, text);
      }
    }
  });
});
