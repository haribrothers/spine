import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { expenseCategories, expenses, journalEntries, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";

type Who = { cookie: string; userId: string };
type Bulk = { done: string[]; skipped: { id: string; reason: string }[] };

/**
 * US-PUR-21 (D-097) — `POST /expenses/bulk/approve` and `/bulk/reject`:
 * each expense reviewed and posted as a single review would be, Staff's own
 * expenses skipped (D-085), one comment for every rejection, at most 100.
 * Requires local Postgres.
 */
describe("US-PUR-21 · approve several expenses at once (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const createdEmails: string[] = [];
  let orgId: string;
  let categoryId: string;
  const owner: Who = { cookie: "", userId: "" };
  const approver: Who = { cookie: "", userId: "" };
  const colleague: Who = { cookie: "", userId: "" };
  const outsider: Who = { cookie: "", userId: "" };

  async function newUser(name: string): Promise<Who> {
    const email = `us-pur-21-${name}-${randomUUID()}@example.com`;
    createdEmails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  async function joinTeam(who: Who, teamId: string) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const [row] = await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role: "staff", createdAt: new Date() }).returning();
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    await db.insert(teamMemberships).values({ teamId, memberId: row!.id });
  }

  async function submittedBy(who: Who, amount = 6400n): Promise<string> {
    const [row] = await db.insert(expenses).values({ orgId, categoryId, date: new Date(), currency: "USD", amount, submittedByUserId: who.userId, description: "Fuel" }).returning();
    return row!.id;
  }

  const bulk = async (who: Who, action: "approve" | "reject", body: Record<string, unknown>) => {
    const res = await fetch(`${testApp.baseUrl}/expenses/bulk/${action}`, {
      method: "POST",
      headers: { cookie: who.cookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as Bulk & { message?: string } };
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [category] = await db.insert(expenseCategories).values({ orgId, name: `Fuel ${randomUUID()}` }).returning();
    categoryId = category!.id;

    const [approvers] = await db.insert(teams).values({ orgId, name: `Approvers ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values([
      { teamId: approvers!.id, capability: "expenses.approve", granted: true },
      { teamId: approvers!.id, capability: "expenses.reject", granted: true },
    ]);
    Object.assign(approver, await newUser("approver"));
    await joinTeam(approver, approvers!.id);
    Object.assign(colleague, await newUser("colleague"));
    await joinTeam(colleague, approvers!.id);

    const [noApproval] = await db.insert(teams).values({ orgId, name: `Submitters ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values([
      { teamId: noApproval!.id, capability: "expenses.approve", granted: false },
      { teamId: noApproval!.id, capability: "expenses.reject", granted: false },
    ]);
    Object.assign(outsider, await newUser("outsider"));
    await joinTeam(outsider, noApproval!.id);
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    if (createdEmails.length) await db.delete(user).where(inArray(user.email, createdEmails));
  });

  it("approves each eligible expense and posts each one, exactly as a single approval; skips own and non-submitted with reasons", async () => {
    const a = await submittedBy(colleague, 6400n);
    const b = await submittedBy(colleague, 19200n);
    const own = await submittedBy(approver);
    const alreadyApproved = await submittedBy(colleague);
    await bulk(owner, "approve", { ids: [alreadyApproved] });

    const { status, body } = await bulk(approver, "approve", { ids: [a, b, own, alreadyApproved] });
    expect(status).toBeLessThan(300);
    expect(body.done).toEqual([a, b]);
    expect(body.skipped.map((s) => [s.id, s.reason])).toEqual([
      [own, "It's your own expense — someone else reviews it."],
      [alreadyApproved, "It isn't waiting for approval."],
    ]);

    const rows = await db.select().from(expenses).where(inArray(expenses.id, [a, b, own]));
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const id of [a, b]) {
      expect(byId.get(id)).toMatchObject({ status: "approved", approvedByUserId: approver.userId });
      expect(byId.get(id)!.number).toMatch(/\S/);
      expect(byId.get(id)!.journalEntryId).not.toBeNull();
    }
    expect(byId.get(own)!.status).toBe("submitted");
    // One balanced journal entry per approved expense.
    const entries = await db.select().from(journalEntries).where(inArray(journalEntries.id, [byId.get(a)!.journalEntryId!, byId.get(b)!.journalEntryId!]));
    expect(entries.map((e) => [e.totalDebits, e.totalCredits])).toEqual(expect.arrayContaining([[6400n, 6400n], [19200n, 19200n]]));
  });

  it("an Owner may approve their own expense in bulk (D-085)", async () => {
    const own = await submittedBy(owner);
    expect((await bulk(owner, "approve", { ids: [own] })).body.done).toEqual([own]);
  });

  it("rejecting applies one comment to every selected expense, and a comment is required", async () => {
    const a = await submittedBy(colleague);
    const b = await submittedBy(colleague);
    const noComment = await bulk(approver, "reject", { ids: [a, b], comment: " " });
    expect(noComment.status).toBe(400);
    expect(noComment.body.message).toBe("Add a comment — it's sent with every rejected expense.");

    const { body } = await bulk(approver, "reject", { ids: [a, b], comment: "Attach the receipt and resubmit." });
    expect(body.done).toEqual([a, b]);
    const rows = await db.select().from(expenses).where(inArray(expenses.id, [a, b]));
    expect(rows.map((r) => [r.status, r.reviewComment])).toEqual([
      ["rejected", "Attach the receipt and resubmit."],
      ["rejected", "Attach the receipt and resubmit."],
    ]);
  });

  it("takes at most 100, and needs expenses.approve / expenses.reject", async () => {
    const tooMany = await bulk(owner, "approve", { ids: Array.from({ length: 101 }, () => randomUUID()) });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.message).toBe("Select 100 or fewer.");
    const id = await submittedBy(colleague);
    expect((await bulk(outsider, "approve", { ids: [id] })).status).toBe(403);
    expect((await bulk(outsider, "reject", { ids: [id], comment: "No" })).status).toBe(403);
  });
});
