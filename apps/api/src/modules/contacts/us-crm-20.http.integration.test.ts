import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LeadStage } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/**
 * US-CRM-20 — deleting a pipeline stage: an empty one just goes; one with
 * leads needs a target stage, and its leads move there in the same save.
 * Requires local Postgres.
 */
describe("US-CRM-20 · delete a stage and move its leads (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-crm-20-${randomUUID()}@example.com`;
  const staffEmail = `us-crm-20-staff-${randomUUID()}@example.com`;
  let cookie: string;
  let staffCookie: string;
  let contactId: string;

  const call = (method: string, route: string, body?: unknown, who = cookie) =>
    fetch(`${testApp.baseUrl}${route}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const stages = async () => (await (await call("GET", "/org/lead-stages")).json()) as LeadStage[];
  const asInput = (list: LeadStage[]) => list.map((s) => ({ id: s.id, name: s.name, kind: s.kind }));
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    const [membership] = await db.select().from(member).where(eq(member.userId, owner.userId));
    const orgId = membership!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, name: "Maple Ridge Developments", type: "customer" }).returning();
    contactId = contact!.id;

    const staff = await signUp(testApp.baseUrl, { email: staffEmail, password: "testpassword123", name: "Staff" });
    staffCookie = staff.cookie;
    await db.delete(member).where(eq(member.userId, staff.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email, staffEmail]));
  });

  it("deletes a stage with no leads", async () => {
    const list = await stages();
    const qualified = list.find((s) => s.name === "Qualified")!;
    expect((await call("PUT", "/org/lead-stages", { stages: asInput(list).filter((s) => s.id !== qualified.id) })).status).toBeLessThan(300);
    expect((await stages()).map((s) => s.name)).toEqual(["New", "Proposal", "Won", "Lost"]);
  });

  it("refuses to delete a stage that still has leads unless they're moved", async () => {
    const list = await stages();
    const proposal = list.find((s) => s.name === "Proposal")!;
    for (const title of ["A", "B", "C"]) await call("POST", "/leads", { contactId, valueCurrency: "USD", title, stageId: proposal.id });
    const res = await call("PUT", "/org/lead-stages", { stages: asInput(list).filter((s) => s.id !== proposal.id) });
    expect(res.status).toBe(400);
    expect(await message(res)).toBe('"Proposal" still has 3 leads. Choose a stage to move them to first.');
    expect((await stages()).find((s) => s.id === proposal.id)?.leadCount).toBe(3);
  });

  it("moves the leads to the chosen stage and removes the stage in one save", async () => {
    const list = await stages();
    const proposal = list.find((s) => s.name === "Proposal")!;
    const won = list.find((s) => s.kind === "won")!;
    const res = await call("PUT", "/org/lead-stages", { stages: asInput(list).filter((s) => s.id !== proposal.id), moves: [{ fromStageId: proposal.id, toStageId: won.id }] });
    expect(res.status).toBeLessThan(300);
    const after = await stages();
    expect(after.find((s) => s.id === proposal.id)).toBeUndefined();
    expect(after.find((s) => s.id === won.id)?.leadCount).toBe(3);
    const leads = (await (await call("GET", "/leads")).json()) as { title: string; stageName: string }[];
    expect(leads.filter((l) => ["A", "B", "C"].includes(l.title)).every((l) => l.stageName === "Won")).toBe(true);
  });

  it("refuses a move into a stage that's being deleted too", async () => {
    const base = asInput(await stages());
    const withTwo = [...base.slice(0, -2), { name: "Survey", kind: "open" }, { name: "Tender", kind: "open" }, ...base.slice(-2)];
    expect((await call("PUT", "/org/lead-stages", { stages: withTwo })).status).toBeLessThan(300);
    const list = await stages();
    const survey = list.find((s) => s.name === "Survey")!;
    const tender = list.find((s) => s.name === "Tender")!;
    await call("POST", "/leads", { contactId, valueCurrency: "USD", title: "D", stageId: survey.id });
    const res = await call("PUT", "/org/lead-stages", {
      stages: asInput(list).filter((s) => s.id !== survey.id && s.id !== tender.id),
      moves: [{ fromStageId: survey.id, toStageId: tender.id }],
    });
    expect(res.status).toBe(400);
    expect(await message(res)).toBe(`Move "Survey"'s leads to a stage you're keeping.`);
  });

  it("Staff can't change the stages", async () => {
    const res = await call("PUT", "/org/lead-stages", { stages: asInput(await stages()) }, staffCookie);
    expect(res.status).toBe(403);
  });
});
