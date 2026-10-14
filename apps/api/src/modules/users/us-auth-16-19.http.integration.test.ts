import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AccountSession } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { emailLog, member, settings, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string; email: string };

const CHROME_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const PHONE = "Spine/1 CFNetwork/1568.100.1 Darwin/24.0.0";

/**
 * US-AUTH-16 to US-AUTH-19 (D-236) — the saved theme, where you're signed
 * in, changing your email safely and the business's defaults on your
 * profile. Requires local Postgres.
 */
describe("US-AUTH-16 to US-AUTH-19 · your account (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "", email: "" };
  const other: Who = { cookie: "", userId: "", email: "" };

  const call = (cookie: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { cookie, "content-type": "application/json", "Idempotency-Key": randomUUID(), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => (await res.json()) as T;

  async function newUser(name: string, into: Who) {
    const email = `us-auth-16-${name.replace(/\s+/g, "-").toLowerCase()}-${randomUUID()}@example.com`;
    emails.push(email);
    Object.assign(into, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }), { email });
  }

  /** A second sign-in, as another device would. */
  async function signIn(email: string, password: string, userAgent: string): Promise<string> {
    const res = await fetch(`${testApp.baseUrl}/api/auth/sign-in/email`, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": userAgent }, body: JSON.stringify({ email, password }) });
    expect(res.status).toBe(200);
    return (res.headers.get("set-cookie") ?? "")
      .split(/,(?=[^;]+?=)/)
      .map((part) => part.split(";")[0]?.trim())
      .filter(Boolean)
      .join("; ");
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    await newUser("Priya Raman", owner);
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await newUser("Someone Else", other);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("US-AUTH-16: the theme is saved to the account and comes back from GET /users/me", async () => {
    expect((await call(owner.cookie, "PUT", "/users/me/preferences", { themePreference: "dark" })).status).toBe(200);
    const phone = await signIn(owner.email, "testpassword123", PHONE);
    expect((await json<{ themePreference: string }>(await call(phone, "GET", "/users/me"))).themePreference).toBe("dark");
  });

  it("US-AUTH-19: names the business's meeting-reminder default and time zone, and removes the photo", async () => {
    const before = await json<{ orgDefaults: { meetingReminderLeadMinutes: number; timeZone: string } }>(await call(owner.cookie, "GET", "/users/me"));
    expect(before.orgDefaults.meetingReminderLeadMinutes).toBe(15);
    expect(before.orgDefaults.timeZone).toBeTruthy();
    await db.insert(settings).values({ orgId, key: "meeting_reminder_lead_minutes", value: { minutes: 30 } });
    expect((await json<{ orgDefaults: { meetingReminderLeadMinutes: number } }>(await call(owner.cookie, "GET", "/users/me"))).orgDefaults.meetingReminderLeadMinutes).toBe(30);

    await call(owner.cookie, "PUT", "/users/me", { image: "https://example.com/photo.jpg" });
    const cleared = await json<{ image: string | null }>(await call(owner.cookie, "PUT", "/users/me", { image: null }));
    expect(cleared.image).toBeNull();
  });

  it("US-AUTH-17: lists where the account is signed in, ends one or all others, never someone else's", async () => {
    const phone = await signIn(owner.email, "testpassword123", PHONE);
    const laptop = await signIn(owner.email, "testpassword123", CHROME_MAC);
    const list = await json<AccountSession[]>(await call(laptop, "GET", "/users/me/sessions"));
    expect(list[0]).toMatchObject({ current: true, device: "Chrome on macOS" });
    expect(list.map((s) => s.device)).toContain("Spine app on iPhone");

    // The phone's session ends; it's signed out.
    const phoneSession = (await json<AccountSession[]>(await call(phone, "GET", "/users/me/sessions"))).find((s) => s.current)!;
    expect((await call(laptop, "DELETE", `/users/me/sessions/${phoneSession.id}`)).status).toBe(200);
    expect((await call(phone, "GET", "/users/me")).status).toBe(401);
    // This device's own session isn't ended this way, and another person's is 404.
    expect((await call(laptop, "DELETE", `/users/me/sessions/${list[0]!.id}`)).status).toBe(400);
    const theirs = (await json<AccountSession[]>(await call(other.cookie, "GET", "/users/me/sessions")))[0]!;
    expect((await call(laptop, "DELETE", `/users/me/sessions/${theirs.id}`)).status).toBe(404);
    expect((await call(other.cookie, "GET", "/users/me")).status).toBe(200);

    // Sign out of other devices: only this one is left.
    const res = await json<{ signedOut: number }>(await call(laptop, "POST", "/users/me/sessions/sign-out-others"));
    expect(res.signedOut).toBeGreaterThanOrEqual(1);
    expect(await json<AccountSession[]>(await call(laptop, "GET", "/users/me/sessions"))).toHaveLength(1);
    owner.cookie = laptop;
  });

  it("US-AUTH-17: changing the password signs out other devices unless unticked", async () => {
    const phone = await signIn(owner.email, "testpassword123", PHONE);
    expect((await call(owner.cookie, "PUT", "/users/me/password", { currentPassword: "testpassword123", newPassword: "betterpassword456", signOutOthers: false })).status).toBe(200);
    expect((await call(phone, "GET", "/users/me")).status).toBe(200);
    expect((await call(owner.cookie, "PUT", "/users/me/password", { currentPassword: "betterpassword456", newPassword: "testpassword123" })).status).toBe(200);
    expect((await call(phone, "GET", "/users/me")).status).toBe(401);
    // This device stays signed in.
    expect((await call(owner.cookie, "GET", "/users/me")).status).toBe(200);
  });

  it("US-AUTH-18: a new email needs the password, can't be taken, and tells the old address", async () => {
    // Not through PUT /users/me any more.
    expect((await call(owner.cookie, "PUT", "/users/me", { email: "new@example.com" })).status).toBe(400);

    const newEmail = `us-auth-18-${randomUUID()}@example.com`;
    emails.push(newEmail);
    const wrong = await call(owner.cookie, "PUT", "/users/me/email", { newEmail, currentPassword: "not-my-password" });
    expect(wrong.status).toBe(400);
    expect((await json<{ message: string }>(wrong)).message).toBe("That password isn't right.");

    const taken = await call(owner.cookie, "PUT", "/users/me/email", { newEmail: other.email.toUpperCase(), currentPassword: "testpassword123" });
    expect(taken.status).toBe(409);
    expect((await json<{ message: string }>(taken)).message).toBe("Another account uses that email.");

    const done = await call(owner.cookie, "PUT", "/users/me/email", { newEmail, currentPassword: "testpassword123" }, { "User-Agent": CHROME_MAC });
    expect(done.status).toBe(200);
    expect((await json<{ email: string }>(done)).email).toBe(newEmail);
    const [notice] = await db.select().from(emailLog).where(and(eq(emailLog.orgId, orgId), eq(emailLog.kind, "email_changed")));
    expect(notice).toMatchObject({ toAddress: owner.email, subject: "Your Spine sign-in email changed" });
    // Signs in with the new address.
    await signIn(newEmail, "testpassword123", CHROME_MAC);
  });
});
