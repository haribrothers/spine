import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LeadHistoryEntry, LeadStage } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

interface LeadRow {
  id: string;
  ownerUserId: string | null;
  createdByUserId: string | null;
  expectedCloseDate: string | null;
}

/**
 * US-CRM-27 (D-211) — the lead drawer's API: owner (an active member),
 * expected close date, and the history read from the audit log.
 * Requires local Postgres.
 */
describe("US-CRM-27 · owner, expected close date and history for a lead (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-crm-27-${randomUUID()}@example.com`;
  const staffEmail = `us-crm-27-staff-${randomUUID()}@example.com`;
  const outsiderEmail = `us-crm-27-out-${randomUUID()}@example.com`;
  let cookie: string;
  let ownerId: string;
  let staffId: string;
  let outsiderId: string;
  let contactId: string;
  let stages: LeadStage[];

  const call = (method: string, route: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${route}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => (await res.json()) as T;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Priya Raman" });
    cookie = owner.cookie;
    ownerId = owner.userId;
    const [membership] = await db.select().from(member).where(eq(member.userId, owner.userId));
    const orgId = membership!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, name: "Ananya Rao", type: "customer" }).returning();
    contactId = contact!.id;

    const staff = await signUp(testApp.baseUrl, { email: staffEmail, password: "testpassword123", name: "Arjun Kumar" });
    staffId = staff.userId;
    await db.delete(member).where(eq(member.userId, staff.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    outsiderId = (await signUp(testApp.baseUrl, { email: outsiderEmail, password: "testpassword123", name: "Elsewhere" })).userId;
    stages = await json<LeadStage[]>(await call("GET", "/org/lead-stages"));
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email, staffEmail, outsiderEmail]));
  });

  it("assigns any active member as owner, or no one, without changing who created it", async () => {
    const lead = await json<LeadRow>(await call("POST", "/leads", { contactId, valueCurrency: "INR", title: "Ground-floor extension" }));
    const assigned = await json<LeadRow>(await call("PUT", `/leads/${lead.id}`, { ownerUserId: staffId, expectedCloseDate: "2026-10-30" }));
    expect(assigned).toMatchObject({ ownerUserId: staffId, createdByUserId: ownerId, expectedCloseDate: "2026-10-30" });
    expect(await json<LeadRow>(await call("PUT", `/leads/${lead.id}`, { ownerUserId: null }))).toMatchObject({ ownerUserId: null });
  });

  it("refuses an owner from outside the organisation, or one who's been deactivated", async () => {
    const lead = await json<LeadRow>(await call("POST", "/leads", { contactId, valueCurrency: "INR" }));
    const outsider = await call("PUT", `/leads/${lead.id}`, { ownerUserId: outsiderId });
    expect(outsider.status).toBe(400);
    expect(((await outsider.json()) as { message: string }).message).toBe("Choose someone in your organisation.");

    await db.update(member).set({ isActive: false }).where(eq(member.userId, staffId));
    expect((await call("PUT", `/leads/${lead.id}`, { ownerUserId: staffId })).status).toBe(400);
    await db.update(member).set({ isActive: true }).where(eq(member.userId, staffId));
  });

  it("lists the lead's creation and each stage change, newest first, with who", async () => {
    const lead = await json<LeadRow>(await call("POST", "/leads", { contactId, valueCurrency: "INR", title: "School block" }));
    const [first, second, third] = stages;
    await call("PUT", `/leads/${lead.id}`, { stageId: second!.id });
    await call("PUT", `/leads/${lead.id}`, { title: "School block extension" });
    await call("PUT", `/leads/${lead.id}`, { stageId: third!.id });

    const history = await json<LeadHistoryEntry[]>(await call("GET", `/leads/${lead.id}/history`));
    expect(history.map(({ kind, fromStage, toStage, actorName }) => ({ kind, fromStage, toStage, actorName }))).toEqual([
      { kind: "stage", fromStage: second!.name, toStage: third!.name, actorName: "Priya Raman" },
      { kind: "stage", fromStage: first!.name, toStage: second!.name, actorName: "Priya Raman" },
      { kind: "created", fromStage: null, toStage: first!.name, actorName: "Priya Raman" },
    ]);
    expect((await call("GET", `/leads/${randomUUID()}/history`)).status).toBe(404);
  });
});
