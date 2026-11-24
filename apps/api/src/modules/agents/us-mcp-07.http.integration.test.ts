import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const PORT = vi.hoisted(() => {
  const port = 4800 + Number(process.env.VITEST_POOL_ID ?? 0);
  process.env.API_URL = `http://localhost:${port}`;
  return port;
});

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createDb, type Database } from "../../db/client";
import { activities, agentConnections, auditLog, jobAssignments, jobNotes, leads, member, quotes, session as sessionTable, vendorBills } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { TestAgent, connectAgent } from "../../test-utils/agent-client";
import { customerWithJob } from "../mobile/field-user.test-helper";
import { draftLimiter } from "./tools/draft-tools";

type Who = { cookie: string; userId: string };
type Text = { content: { type: string; text: string }[]; isError?: boolean };
const parse = (r: unknown) => JSON.parse((r as Text).content[0]!.text) as Record<string, unknown>;
const DRAFT_TOOLS = ["create_lead", "draft_quote", "draft_vendor_bill", "add_note"];

/** US-MCP-07 (D-256, D-259) — have an agent start work as drafts. Requires local Postgres. */
describe("US-MCP-07 · have an agent start work as drafts (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  const base = `http://localhost:${PORT}`;
  let customerId: string;
  let vendorId: string;
  let deckBoardsId: string;
  let assignedJobId: string;
  let otherJobId: string;
  let ownerAgent: TestAgent;
  const clients: Record<"owner" | "field" | "reader", Client> = {} as never;

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const names = async (c: Client) => (await c.listTools()).tools.map((t) => t.name);

  beforeAll(async () => {
    testApp = await createTestApp({ port: PORT });
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "Priya Raman"], [field, "Marcus Webb"]] as const) {
      Object.assign(who, await signUp(base, { email: `us-mcp-07-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, field.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.userId, role: "field", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, field.userId));

    customerId = (await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "customer", name: "Harbour Road Residences" }))).id;
    vendorId = (await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "vendor", name: "Coastal Timber" }))).id;
    deckBoardsId = (await json<{ id: string }>(await call(owner, "POST", "/catalog-items", { name: "Hardwood deck boards", unit: "m²", defaultPriceAmount: "48000", defaultPriceCurrency: "USD", defaultTaxRatePercentage: 10 }))).id;
    assignedJobId = (await customerWithJob(db, orgId)).jobId;
    otherJobId = (await customerWithJob(db, orgId, { customer: { name: "Somebody Else Ltd" } })).jobId;
    await db.insert(jobAssignments).values({ jobId: assignedJobId, userId: field.userId, orgId });

    expect((await call(owner, "PUT", "/org/agents", { enabled: true })).status).toBe(200);
    ownerAgent = new TestAgent("Owner Agent");
    clients.owner = await connectAgent(base, owner.cookie, ownerAgent);
    clients.field = await connectAgent(base, field.cookie, new TestAgent("Field Agent"));
    clients.reader = await connectAgent(base, owner.cookie, new TestAgent("Reader Agent"), { scope: "spine:read" });
  }, 180_000);

  afterAll(async () => {
    for (const c of Object.values(clients)) await c?.close();
    await testApp?.close();
  });

  it("offers the draft tools the person may use, none of them destructive; a read-only connection gets none", async () => {
    const tools = (await clients.owner.listTools()).tools;
    for (const name of DRAFT_TOOLS) expect(tools.find((t) => t.name === name)?.annotations?.destructiveHint).toBe(false);
    expect((await names(clients.reader)).filter((n) => DRAFT_TOOLS.includes(n))).toEqual([]);
    // Field: notes on their jobs only.
    const fieldTools = (await clients.field.listTools()).tools;
    expect(fieldTools.filter((t) => DRAFT_TOOLS.includes(t.name)).map((t) => t.name)).toEqual(["add_note"]);
    expect((fieldTools.find((t) => t.name === "add_note")!.inputSchema.properties!.on as { enum: string[] }).enum).toEqual(["job"]);
  });

  it("draft_quote makes a draft with catalogue prices and Spine's totals, marked as made via the agent for the person", async () => {
    const result = parse(
      await clients.owner.callTool({
        name: "draft_quote",
        arguments: { contactId: customerId, title: "Deck repair", lines: [{ catalogItemId: deckBoardsId, quantity: 2 }, { name: "Carpentry labour", quantity: 1, unitPriceAmount: "19000" }] },
      }),
    );
    const quote = result.quote as { id: string; status: string; number: string | null; totalAmount: string };
    expect(quote).toMatchObject({ status: "draft", number: null });
    expect(result.link).toMatch(new RegExp(`/quotes/${quote.id}$`));
    expect(result.message).toContain("Open it in Spine to check and send it");
    const [row] = await db.select().from(quotes).where(eq(quotes.id, quote.id));
    expect(row).toMatchObject({ status: "draft", createdByUserId: owner.userId });
    const activity = await json<{ type: string; via?: string; actorName: string }[]>(await call(owner, "GET", `/quotes/${quote.id}/activity`));
    expect(activity.find((e) => e.type === "created")).toMatchObject({ via: "Owner Agent", actorName: "Priya Raman" });
    const [entry] = await db.select().from(auditLog).where(and(eq(auditLog.entityType, "quote"), eq(auditLog.entityId, quote.id)));
    expect(entry!.via).toBe("Owner Agent");
  });

  it("a retried call (the same request) creates nothing twice", async () => {
    const before = (await db.select().from(quotes).where(eq(quotes.orgId, orgId))).length;
    const body = { jsonrpc: "2.0", id: 4242, method: "tools/call", params: { name: "draft_quote", arguments: { contactId: customerId, lines: [{ name: "Site visit", quantity: 1, unitPriceAmount: "5000" }] } } };
    const send = () => fetch(`${base}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${ownerAgent.tokens()!.access_token}` }, body: JSON.stringify(body) });
    const first = (await (await send()).json()) as { result: Text };
    const again = (await (await send()).json()) as { result: Text };
    expect((parse(again.result).quote as { id: string }).id).toBe((parse(first.result).quote as { id: string }).id);
    expect((await db.select().from(quotes).where(eq(quotes.orgId, orgId))).length).toBe(before + 1);
  });

  it("draft_vendor_bill makes a draft that posts nothing", async () => {
    const result = parse(await clients.owner.callTool({ name: "draft_vendor_bill", arguments: { contactId: vendorId, billNumber: "CT-8812", date: "2026-10-14", lines: [{ name: "Treated pine", quantity: 10, unitPriceAmount: "2500" }] } }));
    const bill = result.bill as { id: string; status: string };
    expect(bill.status).toBe("draft");
    expect((await db.select().from(vendorBills).where(eq(vendorBills.id, bill.id)))[0]).toMatchObject({ status: "draft", journalEntryId: null });
    expect(result.message).toContain("nothing is posted until then");
  });

  it("create_lead adds a new customer, the lead and the enquiry as its first note", async () => {
    const result = parse(await clients.owner.callTool({ name: "create_lead", arguments: { newContact: { name: "Anika Shah", email: "anika@example.com" }, title: "Kitchen renovation", enquiry: "Hi, we'd like a quote to redo our kitchen next month." } }));
    const lead = result.lead as { id: string; contactId: string };
    expect((await db.select().from(leads).where(eq(leads.id, lead.id)))[0]).toMatchObject({ title: "Kitchen renovation" });
    expect((await db.select().from(activities).where(eq(activities.leadId, lead.id)))[0]).toMatchObject({ type: "note", notes: "Hi, we'd like a quote to redo our kitchen next month." });
  });

  it("Field adds notes to their assigned job, not to someone else's", async () => {
    const ok = parse(await clients.field.callTool({ name: "add_note", arguments: { on: "job", id: assignedJobId, text: "Deck frame up; boards arrive Thursday." } }));
    expect(ok.message).toBe("Added the note.");
    expect((await db.select().from(jobNotes).where(eq(jobNotes.jobId, assignedJobId)))[0]).toMatchObject({ body: "Deck frame up; boards arrive Thursday.", createdByUserId: field.userId });
    const refused = (await clients.field.callTool({ name: "add_note", arguments: { on: "job", id: otherJobId, text: "Not mine" } })) as Text;
    expect(refused.isError).toBe(true);
  });

  it("past 30 drafts an hour from one connection, it's told to try later; with drafts off for everyone, the tools go", async () => {
    const [conn] = await db.select().from(agentConnections).where(and(eq(agentConnections.userId, owner.userId), eq(agentConnections.clientName, "Owner Agent")));
    for (let i = 0; i < 40; i++) draftLimiter.hit(conn!.id);
    const limited = (await clients.owner.callTool({ name: "draft_quote", arguments: { contactId: customerId, lines: [{ name: "x", quantity: 1, unitPriceAmount: "1" }] } })) as Text;
    expect(limited.isError).toBe(true);
    expect(limited.content[0]!.text).toBe("Too many drafts from this agent. Try again later.");

    expect((await call(owner, "PUT", "/org/agents", { drafts: false })).status).toBe(200);
    expect((await names(clients.owner)).filter((n) => DRAFT_TOOLS.includes(n))).toEqual([]);
    expect((await call(owner, "PUT", "/org/agents", { drafts: true })).status).toBe(200);
  });
});
