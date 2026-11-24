import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../db/client";
import { invitation, member, settings, user } from "../db/schema";
import { createTestApp, signUp, type TestApp } from "../test-utils/test-app";
import { INVITE_ONLY_MESSAGE, openSignupForced } from "./signup-policy";

/**
 * US-AUTH-08 — sign-up is invite-only once an instance has accounts. The
 * test database always has accounts, so these run with the tests' open-
 * sign-up switch turned off. Requires local Postgres.
 */
describe("US-AUTH-08 · sign-up is invite-only (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const createdEmails: string[] = [];
  const saved = process.env.SPINE_ALLOW_OPEN_SIGNUP;

  const directSignUp = (email: string) =>
    fetch(`${testApp.baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "testpassword123", name: "Walk-in" }),
    });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    // Make sure the instance has an owner with a business name.
    const email = `us-auth-08-owner-${randomUUID()}@example.com`;
    createdEmails.push(email);
    await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.SPINE_ALLOW_OPEN_SIGNUP;
    else process.env.SPINE_ALLOW_OPEN_SIGNUP = saved;
  });

  afterAll(async () => {
    await testApp?.close();
    if (createdEmails.length) await db.delete(user).where(inArray(user.email, createdEmails));
  });

  it("reports sign-up as closed, with the business name of the instance's first organisation", async () => {
    delete process.env.SPINE_ALLOW_OPEN_SIGNUP;
    const [primary] = await db.select().from(member).where(eq(member.isPrimaryOwner, true)).orderBy(asc(member.createdAt)).limit(1);
    const name = `Riverstone ${randomUUID().slice(0, 6)}`;
    await db
      .insert(settings)
      .values({ orgId: primary!.organizationId, key: "business_profile", value: { name } })
      .onConflictDoUpdate({ target: [settings.orgId, settings.key], set: { value: { name } } });

    const status = await (await fetch(`${testApp.baseUrl}/public/signup-status`)).json();
    expect(status).toEqual({ open: false, businessName: name, newInstall: false });
  });

  it("refuses a direct sign-up without an invitation", async () => {
    delete process.env.SPINE_ALLOW_OPEN_SIGNUP;
    const email = `us-auth-08-walkin-${randomUUID()}@example.com`;
    createdEmails.push(email);
    const res = await directSignUp(email);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { message: string }).message).toBe(INVITE_ONLY_MESSAGE);
    expect(await db.select().from(user).where(eq(user.email, email))).toEqual([]);
  });

  it("accepts a sign-up that completes a pending invitation", async () => {
    delete process.env.SPINE_ALLOW_OPEN_SIGNUP;
    const [primary] = await db.select().from(member).where(eq(member.isPrimaryOwner, true)).limit(1);
    const email = `us-auth-08-invited-${randomUUID()}@example.com`;
    createdEmails.push(email);
    await db.insert(invitation).values({
      id: randomUUID(),
      organizationId: primary!.organizationId,
      email,
      role: "staff",
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      inviterId: primary!.userId,
    });
    expect((await directSignUp(email)).status).toBe(200);
    expect((await db.select().from(user).where(and(eq(user.email, email)))).length).toBe(1);
  });

  it("only honours the tests' open-sign-up switch outside production", () => {
    expect(openSignupForced({ SPINE_ALLOW_OPEN_SIGNUP: "true", NODE_ENV: "test" })).toBe(true);
    expect(openSignupForced({ SPINE_ALLOW_OPEN_SIGNUP: "true", NODE_ENV: "production" })).toBe(false);
    expect(openSignupForced({ NODE_ENV: "test" })).toBe(false);
  });
});
