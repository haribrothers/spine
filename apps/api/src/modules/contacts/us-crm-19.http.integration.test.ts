import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LeadStage } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/**
 * US-CRM-19 — an organisation's own pipeline stages: seeded at sign-up,
 * renamed, reordered and added through `PUT /org/lead-stages`, with Won and
 * Lost fixed at the end. Requires local Postgres.
 */
describe("US-CRM-19 · rename, reorder and add pipeline stages (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-crm-19-${randomUUID()}@example.com`;
  const otherEmail = `us-crm-19-other-${randomUUID()}@example.com`;
  let cookie: string;
  let otherCookie: string;
  let contactId: string;

  const call = (method: string, route: string, body?: unknown, who = cookie) =>
    fetch(`${testApp.baseUrl}${route}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const stages = async (who = cookie) => (await (await call("GET", "/org/lead-stages", undefined, who)).json()) as LeadStage[];
  const put = (list: { id?: string; name: string; kind: string }[]) => call("PUT", "/org/lead-stages", { stages: list });
  const asInput = (list: LeadStage[]) => list.map((s) => ({ id: s.id, name: s.name, kind: s.kind }));

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    const [membership] = await db.select().from(member).where(eq(member.userId, owner.userId));
    const [contact] = await db.insert(contacts).values({ orgId: membership!.organizationId, name: "Harborview Construction Co.", type: "customer" }).returning();
    contactId = contact!.id;
    otherCookie = (await signUp(testApp.baseUrl, { email: otherEmail, password: "testpassword123", name: "Elsewhere" })).cookie;
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email, otherEmail]));
  });

  it("a new organisation has New, Qualified, Proposal, Won and Lost with lead counts", async () => {
    const list = await stages();
    expect(list.map((s) => [s.name, s.kind, s.leadCount])).toEqual([
      ["New", "open", 0],
      ["Qualified", "open", 0],
      ["Proposal", "open", 0],
      ["Won", "won", 0],
      ["Lost", "lost", 0],
    ]);
  });

  it("a lead with no stage goes into the first open stage and reads back its stage's name and kind", async () => {
    const res = await call("POST", "/leads", { contactId, valueCurrency: "USD", title: "Marina office fit-out" });
    const lead = (await res.json()) as { stageId: string; stageName: string; stageKind: string };
    expect(lead).toMatchObject({ stageName: "New", stageKind: "open" });
  });

  it("renaming Proposal to Quote sent keeps its leads", async () => {
    const list = await stages();
    const proposal = list.find((s) => s.name === "Proposal")!;
    await call("POST", "/leads", { contactId, valueCurrency: "USD", title: "Hotel lobby", stageId: proposal.id });
    const res = await put(asInput(list).map((s) => (s.id === proposal.id ? { ...s, name: "Quote sent" } : s)));
    expect(res.status).toBeLessThan(300);
    const after = await stages();
    expect(after.find((s) => s.id === proposal.id)).toMatchObject({ name: "Quote sent", leadCount: 1 });
    const leads = (await (await call("GET", "/leads")).json()) as { title: string; stageName: string }[];
    expect(leads.find((l) => l.title === "Hotel lobby")?.stageName).toBe("Quote sent");
  });

  it("a new stage saved above Quote sent appears in that position", async () => {
    const list = asInput(await stages());
    const at = list.findIndex((s) => s.name === "Quote sent");
    list.splice(at, 0, { id: undefined as unknown as string, name: "Site visit booked", kind: "open" });
    expect((await put(list)).status).toBeLessThan(300);
    expect((await stages()).map((s) => s.name)).toEqual(["New", "Qualified", "Site visit booked", "Quote sent", "Won", "Lost"]);
  });

  it("refuses more than 12 stages with 'Up to 12 stages.'", async () => {
    const list = asInput(await stages());
    const extra = Array.from({ length: 12 - list.length + 1 }, (_, i) => ({ name: `Extra ${i}`, kind: "open" }));
    const res = await put([...list.slice(0, -2), ...extra, ...list.slice(-2)]);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("Up to 12 stages.");
  });

  it("Won and Lost can be renamed but not moved, deleted or turned into open stages", async () => {
    const list = asInput(await stages());
    const won = list.find((s) => s.kind === "won")!;
    const renamed = await put(list.map((s) => (s.id === won.id ? { ...s, name: "Signed" } : s)));
    expect(renamed.status).toBeLessThan(300);
    expect((await stages()).find((s) => s.id === won.id)?.name).toBe("Signed");

    const current = asInput(await stages());
    const moved = await put([current.at(-2)!, ...current.slice(0, -2), current.at(-1)!]);
    expect(moved.status).toBe(400);
    const withoutLost = await put(current.filter((s) => s.kind !== "lost"));
    expect(withoutLost.status).toBe(400);
    const flipped = await put(current.map((s) => (s.kind === "won" ? { ...s, kind: "open" } : s)));
    expect(flipped.status).toBe(400);
  });

  it("refuses another organisation's stage for a lead", async () => {
    const foreign = (await stages(otherCookie))[0]!;
    const res = await call("POST", "/leads", { contactId, valueCurrency: "USD", stageId: foreign.id });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("Choose one of your pipeline stages.");
  });

  it("the dashboard summary lists every stage in order with its kind", async () => {
    const summary = (await (await call("GET", "/leads/summary-by-stage")).json()) as { name: string; kind: string; count: number }[];
    expect(summary.map((r) => r.name)).toEqual((await stages()).map((s) => s.name));
    expect(summary.find((r) => r.kind === "won")?.name).toBe("Signed");
  });
});
