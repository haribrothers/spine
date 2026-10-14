import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LeadStage } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, leads, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

interface LeadRow {
  id: string;
  stageId: string;
  stageChangedAt: string;
  lastActivityAt: string | null;
  nextFollowUp: { id: string; type: string; dueAt: string } | null;
}

/**
 * US-CRM-25 (D-211) — what a card needs: days in stage (`stageChangedAt`),
 * the next open follow-up and when the lead last saw activity.
 * Requires local Postgres.
 */
describe("US-CRM-25 · cards show days in stage, the next follow-up and the last activity (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-crm-25-${randomUUID()}@example.com`;
  let cookie: string;
  let contactId: string;
  let stages: LeadStage[];

  const call = (method: string, route: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${route}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => (await res.json()) as T;
  const find = async (id: string) => (await json<LeadRow[]>(await call("GET", "/leads"))).find((l) => l.id === id)!;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    const [membership] = await db.select().from(member).where(eq(member.userId, owner.userId));
    const [contact] = await db.insert(contacts).values({ orgId: membership!.organizationId, name: "Ananya Rao", type: "customer" }).returning();
    contactId = contact!.id;
    stages = await json<LeadStage[]>(await call("GET", "/org/lead-stages"));
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("restarts the days-in-stage clock only when the stage changes", async () => {
    const lead = await json<LeadRow>(await call("POST", "/leads", { contactId, valueCurrency: "INR", title: "Ground-floor extension" }));
    const old = new Date(Date.now() - 12 * 86_400_000);
    await db.update(leads).set({ stageChangedAt: old }).where(eq(leads.id, lead.id));

    await call("PUT", `/leads/${lead.id}`, { title: "Ground-floor extension, phase 1" });
    expect(new Date((await find(lead.id)).stageChangedAt).getTime()).toBe(old.getTime());

    const proposal = stages.find((s) => s.name === "Proposal")!;
    await call("PUT", `/leads/${lead.id}`, { stageId: proposal.id });
    expect(Date.now() - new Date((await find(lead.id)).stageChangedAt).getTime()).toBeLessThan(60_000);
  });

  it("gives the earliest open follow-up and the latest activity; nothing when there are none", async () => {
    const lead = await json<LeadRow>(await call("POST", "/leads", { contactId, valueCurrency: "INR", title: "Villa extension" }));
    expect(await find(lead.id)).toMatchObject({ nextFollowUp: null, lastActivityAt: null });

    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const later = new Date(Date.now() + 9 * 86_400_000).toISOString();
    await call("POST", "/activities", { leadId: lead.id, contactId, type: "meeting", notes: "Site visit", dueAt: later });
    const call1 = await json<{ id: string }>(await call("POST", "/activities", { leadId: lead.id, contactId, type: "call", notes: "Confirm scope", dueAt: soon }));

    const row = await find(lead.id);
    expect(row.nextFollowUp).toMatchObject({ id: call1.id, type: "call" });
    expect(new Date(row.nextFollowUp!.dueAt).toISOString()).toBe(soon);
    expect(row.lastActivityAt).not.toBeNull();

    // Done follow-ups don't count as "next".
    await call("POST", `/activities/${call1.id}/done`);
    expect((await find(lead.id)).nextFollowUp).toMatchObject({ type: "meeting" });
  });
});
