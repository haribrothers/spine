import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RetentionHeld } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, journalEntries, journalLines, jobs, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-DASH-20 — `GET /dashboard/retention`: the balance of 1150 Retention
 * Receivable from journal lines grouped by job, the number of jobs holding
 * any, and the three holding the most. `reports.view_receivables` only.
 * Requires local Postgres.
 */
describe("US-DASH-20 · retention held on the dashboard (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const plainStaff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  const jobIds: Record<string, string> = {};

  const get = (who: Who) => fetch(`${testApp.baseUrl}/dashboard/retention`, { headers: { cookie: who.cookie } });

  async function newUser(name: string): Promise<Who> {
    const email = `us-dash-20-${name.replace(/\s+/g, "-").toLowerCase()}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  async function join(who: Who, role: "staff" | "field", grants: string[] = []) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    if (role === "staff") {
      const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
      if (grants.length) await db.insert(teamPrivileges).values(grants.map((capability) => ({ teamId: team!.id, capability, granted: true })));
      await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
    }
  }

  const account = async (code: string) => (await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, code))))[0]!.id;

  async function post(lines: { accountId: string; debit: bigint; credit: bigint; jobId?: string }[]) {
    await db.transaction(async (tx) => {
      const id = randomUUID();
      await tx.insert(journalEntries).values({ id, orgId, date: new Date().toISOString().slice(0, 10), sourceType: "test", sourceId: randomUUID() });
      await tx.insert(journalLines).values(lines.map((l) => ({ entryId: id, ...l })));
    });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("Alex Morgan"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(staff, await newUser("Sarah Mendes"));
    await join(staff, "staff", ["reports.view_receivables"]);
    Object.assign(plainStaff, await newUser("Plain Staff"));
    await join(plainStaff, "staff");
    Object.assign(field, await newUser("Marcus Webb"));
    await join(field, "field");
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("with nothing held, the total is zero on no jobs", async () => {
    expect(await (await get(owner)).json()).toEqual({ total: "0", jobCount: 0, jobs: [] });
  });

  it("totals 1150 by job and names the three holding the most", async () => {
    const [customer] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    for (const [key, name, number] of [
      ["warehouse", "Warehouse slab & canopy", "JOB-004"],
      ["marina", "Marina office fit-out", "JOB-001"],
      ["townhomes", "Phase 2 townhomes — foundations", "JOB-002"],
      ["small", "Small job", "JOB-005"],
      ["released", "Released job", "JOB-006"],
    ] as const) {
      const [job] = await db.insert(jobs).values({ orgId, contactId: customer!.id, name, number: `${number}-${randomUUID().slice(0, 4)}`, currency: "USD", createdByUserId: owner.userId }).returning();
      jobIds[key] = job!.id;
    }
    const [retention, receivable] = await Promise.all([account("1150"), account("1100")]);
    const hold = (job: string, amount: bigint) =>
      post([
        { accountId: retention, debit: amount, credit: 0n, jobId: jobIds[job] },
        { accountId: receivable, debit: 0n, credit: amount, jobId: jobIds[job] },
      ]);
    await hold("warehouse", 107500n);
    await hold("marina", 97000n);
    await hold("townhomes", 87500n);
    await hold("small", 10000n);
    await hold("released", 50000n);
    // Released: retention moves back to receivables, so the job holds nothing.
    await post([
      { accountId: receivable, debit: 50000n, credit: 0n, jobId: jobIds.released },
      { accountId: retention, debit: 0n, credit: 50000n, jobId: jobIds.released },
    ]);

    const body = (await (await get(owner)).json()) as RetentionHeld;
    expect(body.total).toBe("302000");
    expect(body.jobCount).toBe(4);
    expect(body.jobs.map((j) => [j.id, j.name, j.held])).toEqual([
      [jobIds.warehouse, "Warehouse slab & canopy", "107500"],
      [jobIds.marina, "Marina office fit-out", "97000"],
      [jobIds.townhomes, "Phase 2 townhomes — foundations", "87500"],
    ]);
  });

  it("needs reports.view_receivables: Staff with it read it; without it, and Field, are refused", async () => {
    expect((await get(staff)).status).toBe(200);
    expect((await get(plainStaff)).status).toBe(403);
    expect((await get(field)).status).toBe(403);
  });
});
