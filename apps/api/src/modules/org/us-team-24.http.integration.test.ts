import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { auditLog, emailLog, member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

const GIVEN = "copper-Tide-48-lantern";
const CHOSEN = "harbor-Velvet-73-quill";

/** US-TEAM-24 (D-233) — an Owner sets a Staff or Field member's password; never an Owner's. Requires local Postgres. */
describe("US-TEAM-24 · set a Staff or Field member's password (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails = {
    owner: `us-team-24-owner-${randomUUID()}@example.com`,
    other: `us-team-24-owner2-${randomUUID()}@example.com`,
    staff: `us-team-24-staff-${randomUUID()}@example.com`,
    field: `us-team-24-field-${randomUUID()}@example.com`,
  };
  let orgId: string;
  const ids: Record<string, { userId: string; memberId: string; cookie: string }> = {};

  const call = (cookie: string, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { cookie, "Content-Type": "application/json", ...(method === "GET" ? {} : { "Idempotency-Key": randomUUID() }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const signIn = async (email: string, password: string) => {
    const res = await fetch(`${testApp.baseUrl}/api/auth/sign-in/email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    return { status: res.status, cookie: (res.headers.get("set-cookie") ?? "").split(/,(?=[^;]+?=)/).map((p) => p.split(";")[0]!.trim()).join("; ") };
  };

  /** A second signed-up user moved into the owner's business with this role. */
  async function join(key: "other" | "staff" | "field", role: string, name: string) {
    const person = await signUp(testApp.baseUrl, { email: emails[key], password: "testpassword123", name });
    await db.delete(member).where(eq(member.userId, person.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: person.userId, role, createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, person.userId));
    ids[key] = { userId: person.userId, memberId, cookie: person.cookie };
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email: emails.owner, password: "testpassword123", name: "Priya Raman" });
    const [ownerMember] = await db.select().from(member).where(eq(member.userId, owner.userId));
    orgId = ownerMember!.organizationId;
    ids.owner = { userId: owner.userId, memberId: ownerMember!.id, cookie: owner.cookie };
    await join("other", "owner", "Arjun Mehta");
    await join("staff", "staff", "Sarah Mendes");
    await join("field", "field", "Marcus Webb");
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, Object.values(emails)));
  });

  it("refuses an Owner's password — the Primary Owner's above all — your own, a deactivated member's and a non-Owner caller", async () => {
    const onOther = await call(ids.owner!.cookie, "PUT", `/org/members/${ids.other!.memberId}/password`, { newPassword: GIVEN });
    expect(onOther.status).toBe(403);
    expect(await onOther.text()).toContain("Only Arjun Mehta can change their own password.");
    const onPrimary = await call(ids.other!.cookie, "PUT", `/org/members/${ids.owner!.memberId}/password`, { newPassword: GIVEN });
    expect(onPrimary.status).toBe(403);
    expect(await onPrimary.text()).toContain("Only Priya Raman can change their own password.");
    expect((await call(ids.owner!.cookie, "PUT", `/org/members/${ids.owner!.memberId}/password`, { newPassword: GIVEN })).status).toBe(400);
    expect((await call(ids.staff!.cookie, "PUT", `/org/members/${ids.field!.memberId}/password`, { newPassword: GIVEN })).status).toBe(403);
    const common = await call(ids.owner!.cookie, "PUT", `/org/members/${ids.field!.memberId}/password`, { newPassword: "password123" });
    expect(common.status).toBe(400);
    expect(await common.text()).toContain("PASSWORD_TOO_COMMON");

    await db.update(member).set({ isActive: false }).where(eq(member.id, ids.field!.memberId));
    expect((await call(ids.owner!.cookie, "PUT", `/org/members/${ids.field!.memberId}/password`, { newPassword: GIVEN })).status).toBe(400);
    await db.update(member).set({ isActive: true }).where(eq(member.id, ids.field!.memberId));
  });

  it("sets a Staff member's password: signed out everywhere, emailed, audited without the password", async () => {
    const res = await call(ids.owner!.cookie, "PUT", `/org/members/${ids.staff!.memberId}/password`, { newPassword: GIVEN });
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await db.select().from(sessionTable).where(eq(sessionTable.userId, ids.staff!.userId))).toHaveLength(0);
    expect((await call(ids.staff!.cookie, "GET", "/org/members/me")).status).toBe(401);
    const [row] = await db.select({ must: user.mustChangePassword }).from(user).where(eq(user.id, ids.staff!.userId));
    expect(row!.must).toBe(true);
    const [audit] = await db.select().from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "password_set"), eq(auditLog.entityId, ids.staff!.userId)));
    expect(JSON.stringify(audit!.changes)).not.toContain(GIVEN);
    const [mail] = await db.select().from(emailLog).where(and(eq(emailLog.orgId, orgId), eq(emailLog.kind, "password_set_by_owner")));
    expect(mail!.toAddress).toBe(emails.staff);
    expect(mail!.subject).toContain("Priya Raman changed your");
    expect((await signIn(emails.staff, "testpassword123")).status).toBe(401);
  });

  it("at next sign-in they must choose their own — not the one they were given — before anything else works", async () => {
    const signedIn = await signIn(emails.staff, GIVEN);
    expect(signedIn.status).toBe(200);
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, ids.staff!.userId));
    const me = (await (await call(signedIn.cookie, "GET", "/org/members/me")).json()) as { mustChangePassword: boolean; passwordSetBy: { name: string } };
    expect(me.mustChangePassword).toBe(true);
    expect(me.passwordSetBy.name).toBe("Priya Raman");
    const held = await call(signedIn.cookie, "GET", "/contacts");
    expect(held.status).toBe(403);
    expect(await held.text()).toContain("PASSWORD_CHANGE_REQUIRED");

    const same = await call(signedIn.cookie, "PUT", "/org/members/me/password", { newPassword: GIVEN });
    expect(same.status).toBe(400);
    expect(await same.text()).toContain("That's the password you were given. Choose a different one.");
    expect((await call(signedIn.cookie, "PUT", "/org/members/me/password", { newPassword: "short" })).status).toBe(400);
    expect((await call(signedIn.cookie, "PUT", "/org/members/me/password", { newPassword: CHOSEN })).status).toBe(200);

    expect((await call(signedIn.cookie, "GET", "/contacts")).status).not.toBe(403);
    expect(((await (await call(signedIn.cookie, "GET", "/org/members/me")).json()) as { mustChangePassword: boolean }).mustChangePassword).toBe(false);
    expect((await signIn(emails.staff, CHOSEN)).status).toBe(200);
    // Only right after an Owner set it; otherwise Profile asks for the current one.
    expect((await call(signedIn.cookie, "PUT", "/org/members/me/password", { newPassword: "another-Strong-55-pass" })).status).toBe(400);
  });

  it("a Field member's too", async () => {
    expect((await call(ids.owner!.cookie, "PUT", `/org/members/${ids.field!.memberId}/password`, { newPassword: GIVEN })).status).toBe(200);
    expect((await signIn(emails.field, GIVEN)).status).toBe(200);
  });
});
