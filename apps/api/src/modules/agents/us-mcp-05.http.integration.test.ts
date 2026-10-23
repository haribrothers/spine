import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const PORT = vi.hoisted(() => {
  const port = 4760 + Number(process.env.VITEST_POOL_ID ?? 0);
  process.env.API_URL = `http://localhost:${port}`;
  return port;
});

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createDb, type Database } from "../../db/client";
import { jobAssignments, member, session as sessionTable } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { TestAgent, connectAgent } from "../../test-utils/agent-client";
import { customerWithJob } from "../mobile/field-user.test-helper";

type Who = { cookie: string; userId: string };
type Text = { content: { type: string; text: string }[]; isError?: boolean };
const parse = (r: unknown) => JSON.parse((r as Text).content[0]!.text) as Record<string, unknown> & { items: Record<string, unknown>[] };

/** US-MCP-05 (D-259) — ask an agent to find and read records, as the person, with their rights. Requires local Postgres. */
describe("US-MCP-05 · ask an agent to find and read records (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  const base = `http://localhost:${PORT}`;
  let invoice: { id: string; number: string };
  let assignedJobId: string;
  let otherJobId: string;
  const agents: Record<"owner" | "staff" | "field", Client> = {} as never;

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const tools = async (c: Client) => (await c.listTools()).tools;

  beforeAll(async () => {
    testApp = await createTestApp({ port: PORT });
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "Priya Raman"], [staff, "Kavya Iyer"], [field, "Marcus Webb"]] as const) {
      Object.assign(who, await signUp(base, { email: `us-mcp-05-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    for (const [who, role] of [[staff, "staff"], [field, "field"]] as const) {
      await db.delete(member).where(eq(member.userId, who.userId));
      await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
      await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    }
    // Kavya's Team opens quotes but not invoices.
    const teams = await json<{ id: string; isDefault: boolean }[]>(await call(owner, "GET", "/org/teams"));
    const teamId = teams.find((t) => t.isDefault)!.id;
    const staffMember = (await db.select().from(member).where(eq(member.userId, staff.userId)))[0]!;
    await json(await call(owner, "PUT", `/org/teams/${teamId}/members`, { memberIds: [staffMember.id] }));
    await json(await call(owner, "PUT", `/org/teams/${teamId}/privileges`, { privileges: [{ capability: "invoices.open", granted: false }, { capability: "quotes.open", granted: true }] }));

    const contactId = (await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "customer", name: "Harbour Road Residences", email: "harbour@example.com" }))).id;
    const draft = await json<{ id: string }>(await call(owner, "POST", "/invoices", { contactId, currency: "USD", issueDate: "2026-09-01", dueDate: "2026-09-15", lines: [{ name: "Deck repair", quantity: 1, unitPriceAmount: "125000" }] }));
    invoice = await json<{ id: string; number: string }>(await call(owner, "POST", `/invoices/${draft.id}/issue`));
    assignedJobId = (await customerWithJob(db, orgId)).jobId;
    otherJobId = (await customerWithJob(db, orgId, { customer: { name: "Somebody Else Ltd" } })).jobId;
    await db.insert(jobAssignments).values({ jobId: assignedJobId, userId: field.userId, orgId });

    expect((await call(owner, "PUT", "/org/agents", { enabled: true })).status).toBe(200);
    agents.owner = await connectAgent(base, owner.cookie, new TestAgent("Owner Agent"));
    agents.staff = await connectAgent(base, staff.cookie, new TestAgent("Staff Agent"));
    agents.field = await connectAgent(base, field.cookie, new TestAgent("Field Agent"));
  }, 180_000);

  afterAll(async () => {
    for (const c of Object.values(agents)) await c?.close();
    await testApp?.close();
  });

  it("offers search, list_records and get_record, marked read-only, each saying what it returns", async () => {
    const list = await tools(agents.owner);
    for (const name of ["search", "list_records", "get_record"]) {
      const tool = list.find((t) => t.name === name)!;
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.description!.length).toBeGreaterThan(40);
    }
  });

  it("search finds what Spine's search finds for the person", async () => {
    const result = parse(await agents.owner.callTool({ name: "search", arguments: { query: "Harbour Road" } }));
    expect(JSON.stringify(result)).toContain("Harbour Road Residences");
  });

  it("list_records lists a type with filters, amounts formatted and linked, in pages", async () => {
    const result = parse(await agents.owner.callTool({ name: "list_records", arguments: { type: "invoice", status: "issued", limit: 1 } }));
    const [first] = result.items;
    expect(first).toMatchObject({ number: invoice.number, link: expect.stringMatching(new RegExp(`/invoices/${invoice.id}$`)) });
    expect(JSON.stringify(first)).toContain("$1,250.00");
    const contacts = parse(await agents.owner.callTool({ name: "list_records", arguments: { type: "contact", search: "Harbour", limit: 100 } }));
    expect(contacts.items.map((c) => c.name)).toContain("Harbour Road Residences");
  });

  it("get_record opens a record by number with its lines and totals, and says when there's nothing the person can open", async () => {
    const result = parse(await agents.owner.callTool({ name: "get_record", arguments: { type: "invoice", number: invoice.number.toLowerCase() } }));
    expect(result).toMatchObject({ id: invoice.id, number: invoice.number });
    expect(JSON.stringify(result)).toContain("Deck repair");
    const missing = (await agents.owner.callTool({ name: "get_record", arguments: { type: "quote", number: "Q-9999" } })) as Text;
    expect(missing.isError).toBe(true);
    expect(missing.content[0]!.text).toBe("No quote Q-9999 that you can open.");
  });

  it("a Staff member whose Teams can't open invoices isn't offered them, and can't read one by asking", async () => {
    const listTool = (await tools(agents.staff)).find((t) => t.name === "list_records")!;
    const types = (listTool.inputSchema.properties!.type as { enum: string[] }).enum;
    expect(types).toContain("quote");
    expect(types).not.toContain("invoice");
    const tried = (await agents.staff.callTool({ name: "get_record", arguments: { type: "invoice", id: invoice.id } })) as Text;
    expect(tried.isError).toBe(true);
  });

  it("Field gets contacts, the catalogue, only their assigned jobs — without money — and their own expenses", async () => {
    const listTool = (await tools(agents.field)).find((t) => t.name === "list_records")!;
    expect(((listTool.inputSchema.properties!.type as { enum: string[] }).enum).sort()).toEqual(["catalog_item", "contact", "expense", "job"]);
    const jobs = parse(await agents.field.callTool({ name: "list_records", arguments: { type: "job" } }));
    expect(jobs.items.map((j) => j.id)).toEqual([assignedJobId]);
    expect(JSON.stringify(jobs)).not.toMatch(/contractValueAmount|48,000/);
    const other = (await agents.field.callTool({ name: "get_record", arguments: { type: "job", id: otherJobId } })) as Text;
    expect(other.isError).toBe(true);
  });

  it("the agent's calls never show up as one of the person's signed-in devices", async () => {
    const sessions = await json<{ device: string }[]>(await call(owner, "GET", "/users/me/sessions"));
    expect(sessions.every((s) => !String(s.device).includes("spine-agent"))).toBe(true);
    expect(sessions).toHaveLength(1);
  });
});
