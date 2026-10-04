import { randomUUID } from "node:crypto";
import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../db/client";
import { user, verification } from "../db/schema";
import { createTestApp, signUp, type TestApp } from "../test-utils/test-app";
import { RESET_IP_LIMIT, RESET_TOO_MANY_MESSAGE } from "./password-reset";

/**
 * US-AUTH-09 — anyone can ask for a reset link; the answer never says
 * whether the account exists. Requires local Postgres.
 */
describe("US-AUTH-09 · ask for a password reset link (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-auth-09-${randomUUID()}@example.com`;
  let userId: string;

  const requestReset = (address: string, ip = `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`) =>
    fetch(`${testApp.baseUrl}/api/auth/request-password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ email: address }),
    });
  const tokensFor = (id: string) => db.select().from(verification).where(eq(verification.value, id));

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    userId = (await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Sam Lee" })).userId;
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(verification).where(eq(verification.value, userId));
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("answers the same way whether or not the account exists", async () => {
    const known = await requestReset(email);
    const unknown = await requestReset(`nobody-${randomUUID()}@example.com`);
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await known.json()).toEqual(await unknown.json());
  });

  it("creates a single-use token for the account that expires in 1 hour", async () => {
    await db.delete(verification).where(eq(verification.value, userId));
    const before = Date.now();
    await requestReset(email);
    const rows = await tokensFor(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.identifier).toMatch(/^reset-password:/);
    const ttl = rows[0]!.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThan(59 * 60_000);
    expect(ttl).toBeLessThanOrEqual(60 * 60_000 + 5_000);
  });

  it("limits requests from one IP address", async () => {
    const ip = `10.250.${Math.floor(Math.random() * 250)}.1`;
    for (let i = 0; i < RESET_IP_LIMIT.max; i++) {
      expect((await requestReset(`ip-limit-${i}@example.com`, ip)).status).toBe(200);
    }
    const blocked = await requestReset("ip-limit-last@example.com", ip);
    expect(blocked.status).toBe(429);
    expect(((await blocked.json()) as { message: string }).message).toBe(RESET_TOO_MANY_MESSAGE);
    // Another address isn't affected.
    expect((await requestReset("ip-limit-other@example.com", `10.251.0.${Math.floor(Math.random() * 250)}`)).status).toBe(200);
  });

  it("the phone app's link redirects to the web forgot-password page", async () => {
    const res = await fetch(`${testApp.baseUrl}/public/forgot-password`, { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/\/forgot-password$/);
  });

  it("writes no token for an email with no account", async () => {
    const count = async () => (await db.select().from(verification).where(like(verification.identifier, "reset-password:%"))).length;
    const before = await count();
    await requestReset(`nobody-${randomUUID()}@example.com`);
    expect(await count()).toBe(before);
  });
});
