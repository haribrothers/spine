import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { auditLog, emailLog, invitation, invitationTeams, jobAssignments, jobs, member, teamMemberships, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Row = { id: string; name: string; email: string; role: string; isActive: boolean; isDemo: boolean; teams: { name: string }[]; deactivatedAt: string | null };

/** US-ONB-35 (D-216, D-232) — the demo's people, Teams and invites look like a real small team. Requires local Postgres. */
describe("US-ONB-35 · explore Users with a team that looks real (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-onb-35-${randomUUID()}@example.com`;
  let cookie: string;
  let orgId: string;

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { cookie, "Content-Type": "application/json", ...(method === "GET" ? {} : { "Idempotency-Key": randomUUID() }) }, body: body === undefined ? undefined : JSON.stringify(body) });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Priya Raman" });
    cookie = owner.cookie;
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    // The owner's own Team and invite, which the demo must leave alone.
    expect((await call("POST", "/org/teams", { name: "Site supervisors" })).status).toBe(201);
    expect((await call("POST", "/org/invitations", { emails: [`own-invite-${randomUUID()}@example.com`], role: "field" })).status).toBe(201);
    expect((await call("POST", "/demo-data/seed", { country: "IN", industry: "construction" })).status).toBe(201);
  }, 180_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("lists the team: Staff on Teams, Staff on none, Field on a crew, and someone deactivated — all Demo", async () => {
    const rows = (await (await call("GET", "/org/members")).json()) as Row[];
    const by = (name: string) => rows.find((r) => r.name === name)!;
    expect(by("Sarah Mendes").teams.map((t) => t.name)).toEqual(["General Staff"]);
    expect(by("Neha Kapoor").teams.map((t) => t.name)).toEqual(["General Staff", "Accounts"]);
    expect(by("Kavya Iyer")).toMatchObject({ role: "staff", teams: [], isActive: true });
    expect(by("Ravi Kumar")).toMatchObject({ role: "field", isActive: true });
    expect(by("Tom Becker")).toMatchObject({ role: "field", isActive: false });
    expect(by("Tom Becker").deactivatedAt).toBeTruthy();
    for (const name of ["Sarah Mendes", "Neha Kapoor", "Marcus Webb", "Kavya Iyer", "Ravi Kumar", "Tom Becker"]) expect(by(name).isDemo, name).toBe(true);

    const demoJobs = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.isDemo, true)));
    const [ravi] = await db.select({ id: user.id }).from(user).where(eq(user.email, "ravi.kumar.demo@example.com"));
    const raviJobs = await db.select().from(jobAssignments).where(and(eq(jobAssignments.orgId, orgId), eq(jobAssignments.userId, ravi!.id)));
    expect(raviJobs).toHaveLength(1);
    expect(demoJobs.length).toBeGreaterThan(1);
  });

  it("adds an Accounts Team whose grants reach further than General Staff alone", async () => {
    const neha = ((await (await call("GET", "/org/members")).json()) as Row[]).find((r) => r.name === "Neha Kapoor")!;
    const sarah = ((await (await call("GET", "/org/members")).json()) as Row[]).find((r) => r.name === "Sarah Mendes")!;
    const access = async (id: string) => ((await (await call("GET", `/org/members/${id}/access`)).json()) as { capabilities: Record<string, boolean> }).capabilities;
    const [nehaCaps, sarahCaps] = [await access(neha.id), await access(sarah.id)];
    expect(nehaCaps["banking.view"]).toBe(true);
    expect(Object.values(nehaCaps).filter(Boolean).length).toBeGreaterThan(Object.values(sarahCaps).filter(Boolean).length);
    const [accounts] = await db.select().from(teams).where(and(eq(teams.orgId, orgId), eq(teams.name, "Accounts")));
    expect(accounts!.isDemo).toBe(true);
  });

  it("has two invites from the owner — one waiting on both Teams, one expired — that nobody can use, and sends nothing", async () => {
    const list = (await (await call("GET", "/org/invitations")).json()) as { id: string; email: string; inviterName: string; expiresAt: string; teams: { name: string }[] }[];
    const sam = list.find((i) => i.email === "sam.lee.demo@example.com")!;
    const dev = list.find((i) => i.email === "dev.patel.demo@example.com")!;
    expect(sam.teams.map((t) => t.name)).toEqual(["General Staff", "Accounts"]);
    expect(new Date(sam.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(dev.expiresAt).getTime()).toBeLessThan(Date.now());
    expect(sam.inviterName).toBe("Priya Raman");
    expect(await db.select().from(emailLog).where(and(eq(emailLog.orgId, orgId), eq(emailLog.kind, "invitation"), inArray(emailLog.toAddress, [sam.email, dev.email])))).toHaveLength(0);

    // Unusable: the preview reveals nothing and sign-up stays closed to that address.
    expect(await (await fetch(`${testApp.baseUrl}/public/invitations/${sam.id}`)).json()).toEqual({ status: "expired" });
    const before = process.env.SPINE_ALLOW_OPEN_SIGNUP;
    process.env.SPINE_ALLOW_OPEN_SIGNUP = "false";
    try {
      const signup = await fetch(`${testApp.baseUrl}/api/auth/sign-up/email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: sam.email, password: "harbor-Velvet-73-quill", name: "Sam" }) });
      expect(signup.status).toBe(403);
    } finally {
      process.env.SPINE_ALLOW_OPEN_SIGNUP = before;
    }
  });

  it("reads like the team grew: Neha added to Accounts and Tom deactivated, on their days", async () => {
    const [neha] = await db.select({ id: user.id }).from(user).where(eq(user.email, "neha.kapoor.demo@example.com"));
    const [tom] = await db.select({ id: user.id }).from(user).where(eq(user.email, "tom.becker.demo@example.com"));
    const [teamsChange] = await db.select().from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityId, neha!.id), eq(auditLog.action, "teams_changed")));
    const [deactivated] = await db.select().from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityId, tom!.id), eq(auditLog.action, "deactivated")));
    expect(JSON.stringify(teamsChange!.changes)).toContain("General Staff, Accounts");
    const daysAgo = (d: Date) => Math.round((Date.now() - d.getTime()) / 86_400_000);
    expect(daysAgo(teamsChange!.createdAt)).toBeGreaterThan(30);
    expect(daysAgo(deactivated!.createdAt)).toBe(21);
  });

  it("deleting the demo removes its people's access, the Accounts Team and its invites — and nothing of the owner's", async () => {
    expect((await call("DELETE", "/demo-data")).status).toBeLessThan(300);
    expect(await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.isDemo, true)))).toHaveLength(0);
    const left = await db.select({ name: teams.name }).from(teams).where(eq(teams.orgId, orgId));
    expect(left.map((t) => t.name).sort()).toEqual(["General Staff", "Site supervisors"]);
    const invites = await db.select({ email: invitation.email, isDemo: invitation.isDemo }).from(invitation).where(eq(invitation.organizationId, orgId));
    expect(invites.filter((i) => i.isDemo)).toHaveLength(0);
    expect(invites.filter((i) => i.email.startsWith("own-invite-"))).toHaveLength(1);
    expect(await db.select().from(invitationTeams).innerJoin(teams, eq(teams.id, invitationTeams.teamId)).where(eq(teams.orgId, orgId))).toHaveLength(0);
    expect(await db.select().from(teamMemberships).innerJoin(teams, eq(teams.id, teamMemberships.teamId)).where(and(eq(teams.orgId, orgId), eq(teams.name, "Accounts")))).toHaveLength(0);
  });
});
