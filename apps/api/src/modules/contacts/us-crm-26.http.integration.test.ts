import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LeadStage } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

interface LeadRow {
  id: string;
  stageId: string;
  lostReason: string | null;
  lostNote: string | null;
}

/**
 * US-CRM-26 (D-211) — a lost reason that lives only in a Lost stage, and
 * quotes linked to the lead they were started from. Requires local Postgres.
 */
describe("US-CRM-26 · lost reasons, and quotes started from a won lead (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-crm-26-${randomUUID()}@example.com`;
  const otherEmail = `us-crm-26-other-${randomUUID()}@example.com`;
  let cookie: string;
  let otherCookie: string;
  let contactId: string;
  let otherContactId: string;
  let stages: LeadStage[];

  const call = (method: string, route: string, body?: unknown, who = cookie) =>
    fetch(`${testApp.baseUrl}${route}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => (await res.json()) as T;
  const stage = (kind: "won" | "lost") => stages.find((s) => s.kind === kind)!;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    const [membership] = await db.select().from(member).where(eq(member.userId, owner.userId));
    const orgId = membership!.organizationId;
    const inserted = await db
      .insert(contacts)
      .values([
        { orgId, name: "Halcyon Tech Parks Pvt Ltd", type: "customer" },
        { orgId, name: "Sahyadri Retail Pvt Ltd", type: "customer" },
      ])
      .returning();
    contactId = inserted[0]!.id;
    otherContactId = inserted[1]!.id;
    stages = await json<LeadStage[]>(await call("GET", "/org/lead-stages"));
    otherCookie = (await signUp(testApp.baseUrl, { email: otherEmail, password: "testpassword123", name: "Elsewhere" })).cookie;
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email, otherEmail]));
  });

  it("records a lost reason and note in a Lost stage, and clears them when the lead moves back", async () => {
    const lead = await json<LeadRow>(await call("POST", "/leads", { contactId, valueCurrency: "INR", title: "Warehouse mezzanine" }));
    const lost = await json<LeadRow>(await call("PUT", `/leads/${lead.id}`, { stageId: stage("lost").id, lostReason: "competitor", lostNote: "Lower bid from a local contractor." }));
    expect(lost).toMatchObject({ lostReason: "competitor", lostNote: "Lower bid from a local contractor." });

    const back = await json<LeadRow>(await call("PUT", `/leads/${lead.id}`, { stageId: stages[0]!.id }));
    expect(back).toMatchObject({ lostReason: null, lostNote: null });
  });

  it("ignores a lost reason for a lead that isn't lost, and refuses one that isn't on the list", async () => {
    const lead = await json<LeadRow>(await call("POST", "/leads", { contactId, valueCurrency: "INR", title: "Retail fit-out" }));
    expect(await json<LeadRow>(await call("PUT", `/leads/${lead.id}`, { lostReason: "price" }))).toMatchObject({ lostReason: null });
    expect((await call("PUT", `/leads/${lead.id}`, { stageId: stage("lost").id, lostReason: "weather" })).status).toBe(400);
  });

  it("links a new quote to its lead and lists a lead's quotes", async () => {
    const lead = await json<LeadRow>(await call("POST", "/leads", { contactId, valueCurrency: "INR", title: "Office block" }));
    await call("PUT", `/leads/${lead.id}`, { stageId: stage("won").id });
    const res = await call("POST", "/quotes", { contactId, currency: "INR", leadId: lead.id, lines: [] });
    expect(res.status).toBeLessThan(300);
    const quote = await json<{ id: string; leadId: string }>(res);
    expect(quote.leadId).toBe(lead.id);

    const linked = await json<{ id: string }[]>(await call("GET", `/quotes?leadId=${lead.id}`));
    expect(linked.map((q) => q.id)).toEqual([quote.id]);
  });

  it("refuses a lead for another contact or another organisation", async () => {
    const lead = await json<LeadRow>(await call("POST", "/leads", { contactId, valueCurrency: "INR", title: "Data hall" }));
    const wrongContact = await call("POST", "/quotes", { contactId: otherContactId, currency: "INR", leadId: lead.id, lines: [] });
    expect(wrongContact.status).toBe(400);
    expect(((await wrongContact.json()) as { message: string }).message).toBe("Choose a lead for this contact.");

    // Another organisation can't see or use the lead.
    expect((await call("GET", `/quotes?leadId=${lead.id}`, undefined, otherCookie)).status).toBe(200);
    expect(await json<unknown[]>(await call("GET", `/quotes?leadId=${lead.id}`, undefined, otherCookie))).toEqual([]);
  });
});
