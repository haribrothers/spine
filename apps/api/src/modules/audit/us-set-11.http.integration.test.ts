import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditDetails, type AuditLogPage } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { auditLog, member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-SET-11 (D-064) — `GET /org/audit-log`: every audit entry in the
 * organisation, newest first, 50 a page, filterable by date, person, record
 * type and action, each with its record's name and link; role and access
 * changes are recorded as "User". Owner-only. Requires local Postgres.
 */
describe("US-SET-11 · see every change across the organisation (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  let staffMemberId: string;
  let contactId: string;

  const get = (who: Who, query = "") => fetch(`${testApp.baseUrl}/org/audit-log${query}`, { headers: { cookie: who.cookie } });
  const page = async (query = "") => (await (await get(owner, query)).json()) as AuditLogPage;
  const put = (path: string) => fetch(`${testApp.baseUrl}${path}`, { method: "PUT", headers: { cookie: owner.cookie, "Idempotency-Key": randomUUID() } });

  async function newUser(name: string): Promise<Who> {
    const email = `us-set-11-${name.replace(/\s+/g, "-").toLowerCase()}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("Alex Morgan"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(staff, await newUser("Sarah Mendes"));
    await db.delete(member).where(eq(member.userId, staff.userId));
    staffMemberId = randomUUID();
    await db.insert(member).values({ id: staffMemberId, organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));

    const res = await fetch(`${testApp.baseUrl}/contacts`, {
      method: "POST",
      headers: { cookie: owner.cookie, "content-type": "application/json", "Idempotency-Key": randomUUID() },
      body: JSON.stringify({ type: "customer", name: "Bluewater Hospitality Group" }),
    });
    expect(res.status).toBe(201);
    contactId = ((await res.json()) as { id: string }).id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("lists entries newest first with who, action, the record's name and link", async () => {
    const body = await page();
    const created = body.entries.find((e) => e.entityType === "contact" && e.entityId === contactId)!;
    expect(created).toMatchObject({ action: "created", recordLabel: "Bluewater Hospitality Group", link: `/contacts/${contactId}`, actor: { name: "Alex Morgan" } });
    expect(created.actor!.email).toContain("us-set-11-alex-morgan");
    const times = body.entries.map((e) => e.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("records promote, demote, deactivate and reactivate as 'User' with the old and new role or state", async () => {
    expect((await put(`/org/members/${staffMemberId}/promote`)).status).toBe(200);
    expect((await put(`/org/members/${staffMemberId}/demote`)).status).toBe(200);
    expect((await put(`/org/members/${staffMemberId}/deactivate`)).status).toBe(200);
    expect((await put(`/org/members/${staffMemberId}/reactivate`)).status).toBe(200);

    const users = (await page("?entityType=user")).entries;
    expect(users.map((e) => [e.action, e.recordLabel, auditDetails(e)])).toEqual([
      ["reactivated", "Sarah Mendes", "Deactivated → Active"],
      ["deactivated", "Sarah Mendes", "Active → Deactivated"],
      ["role_changed", "Sarah Mendes", "Owner → Staff"],
      ["role_changed", "Sarah Mendes", "Staff → Owner"],
    ]);
    expect(users[0]!.link).toBe("/team/users");
    expect(users[0]!.entityId).toBe(staff.userId);
  });

  it("filters by person, record type, action and dates", async () => {
    expect((await page(`?userId=${owner.userId}&action=role_changed`)).entries).toHaveLength(2);
    expect((await page(`?userId=${staff.userId}`)).total).toBe(0);
    const facets = (await page()).facets;
    expect(facets.people.map((p) => p.name)).toContain("Alex Morgan");
    expect(facets.entityTypes).toEqual(expect.arrayContaining(["contact", "user"]));
    expect(facets.actions).toEqual(expect.arrayContaining(["created", "role_changed", "deactivated"]));
    expect((await page("?from=2000-01-01&to=2000-01-31")).total).toBe(0);
    const today = new Date();
    const local = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect((await page(`?from=${local}&to=${local}`)).total).toBeGreaterThanOrEqual(5);
    expect((await get(owner, "?from=last-week")).status).toBe(400);
  });

  it("pages 50 at a time", async () => {
    await db.insert(auditLog).values(
      Array.from({ length: 60 }, (_, i) => ({ orgId, actorUserId: owner.userId, action: "updated", entityType: "contact", entityId: contactId, contactId, changes: [{ field: "phone", from: `${i}`, to: `${i + 1}` }], createdAt: new Date(Date.now() - 60_000 - i * 1000) })),
    );
    const first = await page();
    expect(first.entries).toHaveLength(50);
    expect(first.total).toBeGreaterThan(60);
    const second = await page("?cursor=50");
    expect(second.offset).toBe(50);
    expect(second.entries[0]!.id).not.toBe(first.entries[0]!.id);
    expect(new Set([...first.entries, ...second.entries].map((e) => e.id)).size).toBe(first.entries.length + second.entries.length);
  });

  it("is Owner-only", async () => {
    expect((await get(staff)).status).toBe(403);
  });
});
