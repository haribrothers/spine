import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable, teamMemberships, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Team = { id: string; name: string; description: string | null; isDefault: boolean; isDemo: boolean; memberCount: number; members: { memberId: string; name: string }[]; granted: string[] };
type History = { at: string; actorName: string | null; action: string; changes: { field: string; from: unknown; to: unknown }[] | null }[];

/** US-TEAM-25 to US-TEAM-29 (D-234) — Teams you can manage from. Requires local Postgres. */
describe("US-TEAM-25 to US-TEAM-29 · Teams you can manage from (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const ownerEmail = `us-team-25-owner-${randomUUID()}@example.com`;
  const staffEmail = `us-team-25-staff-${randomUUID()}@example.com`;
  let cookie: string;
  let staffCookie: string;
  let orgId: string;
  let generalId: string;
  let staffMemberId: string;

  const call = (c: string, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { cookie: c, "Content-Type": "application/json", ...(method === "GET" ? {} : { "Idempotency-Key": randomUUID() }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email: ownerEmail, password: "testpassword123", name: "Priya Raman" });
    cookie = owner.cookie;
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    generalId = (await db.select().from(teams).where(and(eq(teams.orgId, orgId), eq(teams.isDefault, true))))[0]!.id;
    const staff = await signUp(testApp.baseUrl, { email: staffEmail, password: "testpassword123", name: "Arun Shah" });
    staffCookie = staff.cookie;
    await db.delete(member).where(eq(member.userId, staff.userId));
    staffMemberId = randomUUID();
    await db.insert(member).values({ id: staffMemberId, organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [ownerEmail, staffEmail]));
  });

  it("US-TEAM-26 · creates a Team from another's permissions, never its members; a taken name is refused", async () => {
    await json(await call(cookie, "PUT", `/org/teams/${generalId}/members`, { memberIds: [staffMemberId] }));
    const accounts = await json<Team>(await call(cookie, "POST", "/org/teams", { name: "Accounts", description: "Billing and the books", copyFromTeamId: generalId }));
    const general = (await json<Team[]>(await call(cookie, "GET", "/org/teams"))).find((t) => t.id === generalId)!;
    expect(accounts.description).toBe("Billing and the books");
    expect([...accounts.granted].sort()).toEqual([...general.granted].sort());
    expect(accounts.members).toEqual([]);
    const taken = await call(cookie, "POST", "/org/teams", { name: "accounts" });
    expect(taken.status).toBe(409);
    expect(await taken.text()).toContain("There's already a Team called accounts.");
  });

  it("US-TEAM-25 · the list says who is on each Team and what it grants", async () => {
    const list = await json<Team[]>(await call(cookie, "GET", "/org/teams"));
    const general = list.find((t) => t.id === generalId)!;
    expect(general).toMatchObject({ isDefault: true, isDemo: false, memberCount: 1, members: [{ memberId: staffMemberId, name: "Arun Shah" }] });
    expect(general.granted.length).toBeGreaterThan(0);
    // Owner-only, always.
    expect((await call(staffCookie, "GET", "/org/teams")).status).toBe(403);
  });

  it("US-TEAM-26 · updates name and description; the default Team keeps its name", async () => {
    const accounts = (await json<Team[]>(await call(cookie, "GET", "/org/teams"))).find((t) => t.name === "Accounts")!;
    const updated = await json<Team>(await call(cookie, "PUT", `/org/teams/${accounts.id}`, { name: "Accounts & books", description: "Billing, payments and banking" }));
    expect(updated).toMatchObject({ name: "Accounts & books", description: "Billing, payments and banking" });
    const general = await call(cookie, "PUT", `/org/teams/${generalId}`, { name: "Everyone" });
    expect(general.status).toBe(400);
    expect((await json<Team>(await call(cookie, "PUT", `/org/teams/${generalId}`, { description: "Everyday office work" }))).description).toBe("Everyday office work");
  });

  it("US-TEAM-27, US-TEAM-28, US-TEAM-29 · members and permissions changes are audited and listed newest first", async () => {
    const accounts = (await json<Team[]>(await call(cookie, "GET", "/org/teams"))).find((t) => t.name === "Accounts & books")!;
    await json(await call(cookie, "PUT", `/org/teams/${accounts.id}/members`, { memberIds: [staffMemberId] }));
    await json(await call(cookie, "PUT", `/org/teams/${accounts.id}/privileges`, { privileges: [{ capability: "banking.view", granted: false }, { capability: "banking.reconcile", granted: true }] }));
    await json(await call(cookie, "PUT", `/org/teams/${accounts.id}/members`, { memberIds: [] }));

    const history = await json<History>(await call(cookie, "GET", `/org/teams/${accounts.id}/history`));
    expect(history.map((h) => h.action)).toEqual(["members_changed", "privileges_changed", "members_changed", "updated", "created"]);
    expect(history.every((h) => h.actorName === "Priya Raman")).toBe(true);
    expect(history[0]!.changes).toEqual([{ field: "removed", from: "Arun Shah", to: null }]);
    expect(history[2]!.changes).toEqual([{ field: "added", from: null, to: "Arun Shah" }]);
    // Each permission that changed, by its label.
    expect(history[1]!.changes).toEqual(expect.arrayContaining([{ field: "Reconcile accounts", from: "Off", to: "On" }]));
    expect(history[4]!.changes).toEqual([{ field: "name", from: null, to: "Accounts" }, { field: "copiedFrom", from: null, to: "General Staff" }]);

    const log = (await (await call(cookie, "GET", `/org/audit-log?entityType=team&entityId=${accounts.id}`)).json()) as { entries: { entityId: string; recordLabel: string; link: string }[] };
    expect(log.entries).toHaveLength(5);
    expect(log.entries[0]).toMatchObject({ recordLabel: "Accounts & books", link: `/team/teams/${accounts.id}` });
    expect((await call(staffCookie, "GET", `/org/teams/${accounts.id}/history`)).status).toBe(403);
  });

  it("US-TEAM-25 · deleting a Team is audited with who was on it", async () => {
    const temp = await json<Team>(await call(cookie, "POST", "/org/teams", { name: "Temp crew" }));
    await json(await call(cookie, "PUT", `/org/teams/${temp.id}/members`, { memberIds: [staffMemberId] }));
    expect((await call(cookie, "DELETE", `/org/teams/${temp.id}`)).status).toBeLessThan(300);
    expect(await db.select().from(teamMemberships).where(eq(teamMemberships.teamId, temp.id))).toHaveLength(0);
    const log = (await (await call(cookie, "GET", `/org/audit-log?entityType=team&entityId=${temp.id}&action=deleted`)).json()) as { entries: { changes: unknown }[] };
    expect(log.entries[0]!.changes).toEqual([{ field: "name", from: "Temp crew", to: null }, { field: "members", from: "Arun Shah", to: null }]);
    expect((await call(cookie, "DELETE", `/org/teams/${generalId}`)).status).toBe(400);
  });
});
