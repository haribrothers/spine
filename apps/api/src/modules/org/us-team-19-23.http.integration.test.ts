import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { auditLog, member, teamMemberships, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Ref = { id: string; name: string };
type Row = { id: string; userId: string; name: string; role: string; teams?: Ref[]; lastActiveAt?: string | null; isDemo?: boolean };

/** US-TEAM-19 to US-TEAM-23 (D-232) — Users you can manage from. Requires local Postgres. */
describe("US-TEAM-19 to US-TEAM-23 · Users you can manage from (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const ownerEmail = `us-team-19-owner-${randomUUID()}@example.com`;
  const staffEmail = `us-team-21-staff-${randomUUID()}@example.com`;
  const createdEmails = [ownerEmail, staffEmail];
  let owner: { cookie: string; userId: string };
  let staffCookie: string;
  let orgId: string;
  let generalId: string;
  let accountsId: string;
  let staffMemberId: string;
  let ownerMemberId: string;

  const call = (cookie: string, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { cookie, "Content-Type": "application/json", ...(method === "GET" ? {} : { "Idempotency-Key": randomUUID() }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    owner = await signUp(testApp.baseUrl, { email: ownerEmail, password: "testpassword123", name: "Priya Raman" });
    const [ownerMember] = await db.select().from(member).where(eq(member.userId, owner.userId));
    orgId = ownerMember!.organizationId;
    ownerMemberId = ownerMember!.id;
    generalId = (await db.select().from(teams).where(and(eq(teams.orgId, orgId), eq(teams.isDefault, true))))[0]!.id;
    accountsId = (await json<Ref>(await call(owner.cookie, "POST", "/org/teams", { name: "Accounts" }))).id;
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, createdEmails));
  });

  it("US-TEAM-21 · invites several at once, skipping who can't be invited and why", async () => {
    const result = await json<{ invited: { id: string; email: string }[]; skipped: { email: string; reason: string }[] }>(
      await call(owner.cookie, "POST", "/org/invitations", { emails: [staffEmail.toUpperCase(), "vikram@meridian", ownerEmail, staffEmail], role: "staff", teamIds: [generalId, accountsId] }),
    );
    expect(result.invited.map((i) => i.email)).toEqual([staffEmail]);
    expect(result.skipped).toEqual([
      { email: "vikram@meridian", reason: "not an email address" },
      { email: ownerEmail, reason: "already a member" },
    ]);

    const again = await json<{ skipped: { reason: string }[] }>(await call(owner.cookie, "POST", "/org/invitations", { emails: [staffEmail], role: "staff" }));
    expect(again.skipped).toEqual([{ email: staffEmail, reason: "already invited — resend it instead" }]);

    // Owner is never granted by invite.
    expect((await call(owner.cookie, "POST", "/org/invitations", { emails: ["new@example.com"], role: "owner" })).status).toBe(400);

    const list = await json<{ id: string; email: string; inviterName: string; createdAt: string; teams: Ref[]; acceptUrl: string }[]>(await call(owner.cookie, "GET", "/org/invitations"));
    const row = list.find((i) => i.email === staffEmail)!;
    expect(row.inviterName).toBe("Priya Raman");
    expect(row.createdAt).toBeTruthy();
    expect(row.teams.map((t) => t.name)).toEqual(["General Staff", "Accounts"]);
    expect(row.acceptUrl).toMatch(new RegExp(`/accept-invite/${row.id}$`));
  });

  it("US-TEAM-21 · accepting a Staff invite puts the new member on its Teams", async () => {
    const invite = (await json<{ id: string; email: string }[]>(await call(owner.cookie, "GET", "/org/invitations"))).find((i) => i.email === staffEmail)!;
    const staff = await signUp(testApp.baseUrl, { email: staffEmail, password: "testpassword123", name: "Kavya Iyer" });
    staffCookie = staff.cookie;
    const accepted = await fetch(`${testApp.baseUrl}/api/auth/organization/accept-invitation`, {
      method: "POST",
      headers: { cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId: invite.id }),
    });
    expect(accepted.status, await accepted.clone().text()).toBe(200);
    staffMemberId = (await db.select().from(member).where(and(eq(member.userId, staff.userId), eq(member.organizationId, orgId))))[0]!.id;
    const joined = await db.select({ teamId: teamMemberships.teamId }).from(teamMemberships).where(eq(teamMemberships.memberId, staffMemberId));
    expect(joined.map((j) => j.teamId).sort()).toEqual([generalId, accountsId].sort());
  });

  it("US-TEAM-19 · an Owner's list has each person's Teams, last active and demo flag; others get the rows as before", async () => {
    const rows = await json<Row[]>(await call(owner.cookie, "GET", "/org/members"));
    const staffRow = rows.find((r) => r.id === staffMemberId)!;
    expect(staffRow.teams!.map((t) => t.name)).toEqual(["General Staff", "Accounts"]);
    expect(staffRow.isDemo).toBe(false);
    expect(rows.find((r) => r.id === ownerMemberId)!.lastActiveAt).toBeTruthy();

    const asStaff = await json<Row[]>(await call(staffCookie, "GET", "/org/members"));
    expect(asStaff.find((r) => r.id === staffMemberId)).not.toHaveProperty("teams");
    expect(asStaff.find((r) => r.id === staffMemberId)).not.toHaveProperty("lastActiveAt");
  });

  it("US-TEAM-20 · sets a Staff member's Teams and says what they can open — the same list the API enforces", async () => {
    const updated = await json<Row>(await call(owner.cookie, "PUT", `/org/members/${staffMemberId}/teams`, { teamIds: [accountsId] }));
    expect(updated.teams!.map((t) => t.name)).toEqual(["Accounts"]);
    const [audit] = await db.select().from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "teams_changed")));
    expect(audit!.changes).toEqual([{ field: "teams", from: "General Staff, Accounts", to: "Accounts" }]);

    const ownerTeams = await call(owner.cookie, "PUT", `/org/members/${ownerMemberId}/teams`, { teamIds: [generalId] });
    expect(ownerTeams.status).toBe(400);
    expect(await ownerTeams.text()).toContain("Only Staff are on Teams.");

    await json(await call(owner.cookie, "PUT", `/org/members/${staffMemberId}/teams`, { teamIds: [generalId] }));
    const access = await json<{ role: string; teams: Ref[]; capabilities: Record<string, boolean> }>(await call(owner.cookie, "GET", `/org/members/${staffMemberId}/access`));
    expect(access.role).toBe("staff");
    expect(access.teams.map((t) => t.name)).toEqual(["General Staff"]);
    expect(access.capabilities).toEqual(await json(await call(staffCookie, "GET", "/org/members/me/capabilities")));

    // Owner-only, always.
    expect((await call(staffCookie, "PUT", `/org/members/${staffMemberId}/teams`, { teamIds: [] })).status).toBe(403);
    expect((await call(staffCookie, "GET", `/org/members/${staffMemberId}/access`)).status).toBe(403);
  });

  it("US-TEAM-22 · changes Staff to Field (off their Teams) and back onto the Teams chosen; never an Owner", async () => {
    const field = await json<Row>(await call(owner.cookie, "PUT", `/org/members/${staffMemberId}/role`, { role: "field" }));
    expect(field.role).toBe("field");
    expect(field.teams).toEqual([]);
    expect(await db.select().from(teamMemberships).where(eq(teamMemberships.memberId, staffMemberId))).toHaveLength(0);
    const asField = await json<{ role: string }>(await call(staffCookie, "GET", "/org/members/me"));
    expect(asField.role).toBe("field");

    const staff = await json<Row>(await call(owner.cookie, "PUT", `/org/members/${staffMemberId}/role`, { role: "staff", teamIds: [accountsId] }));
    expect(staff.role).toBe("staff");
    expect(staff.teams!.map((t) => t.name)).toEqual(["Accounts"]);
    const roleChanges = await db.select().from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "role_changed")));
    expect(roleChanges.map((r) => r.changes)).toEqual(expect.arrayContaining([[{ field: "role", from: "Staff", to: "Field" }], [{ field: "role", from: "Field", to: "Staff" }]]));

    const ownerChange = await call(owner.cookie, "PUT", `/org/members/${ownerMemberId}/role`, { role: "field" });
    expect(ownerChange.status).toBe(400);
    expect(await ownerChange.text()).toContain("Only Staff and Field can be changed this way.");
    expect((await call(owner.cookie, "PUT", `/org/members/${staffMemberId}/role`, { role: "owner" })).status).toBe(400);
  });

  it("US-TEAM-23 · nobody can deactivate themselves", async () => {
    const res = await call(owner.cookie, "PUT", `/org/members/${ownerMemberId}/deactivate`);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("You can't deactivate yourself.");
  });

  it("US-TEAM-21 · the onboarding wizard's single invite still works", async () => {
    const email = `us-team-21-single-${randomUUID()}@example.com`;
    const created = await json<{ id: string; email: string }>(await call(owner.cookie, "POST", "/org/invitations", { email, role: "field" }));
    expect(created.email).toBe(email);
    expect(created.id).toBeTruthy();
  });
});
