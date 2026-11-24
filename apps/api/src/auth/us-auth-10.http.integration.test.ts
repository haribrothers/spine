import { randomUUID } from "node:crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../db/client";
import { session, user, verification } from "../db/schema";
import { createTestApp, signUp, type TestApp } from "../test-utils/test-app";

/**
 * US-AUTH-10 — the emailed token sets a new password once, and every
 * existing session ends. Requires local Postgres.
 */
describe("US-AUTH-10 · choose a new password from the reset link (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-auth-10-${randomUUID()}@example.com`;
  let userId: string;
  let password = "testpassword123";

  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${testApp.baseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

  async function newToken(): Promise<string> {
    await db.delete(verification).where(eq(verification.value, userId));
    await post("/api/auth/request-password-reset", { email }, { "x-forwarded-for": `10.10.${Math.floor(Math.random() * 250)}.1` });
    const [row] = await db.select().from(verification).where(and(eq(verification.value, userId), like(verification.identifier, "reset-password:%")));
    return row!.identifier.slice("reset-password:".length);
  }
  const lookup = (token: string) => fetch(`${testApp.baseUrl}/public/password-reset/${token}`);
  const signIn = (pw: string) => post("/api/auth/sign-in/email", { email, password: pw });
  const sessionOf = async (cookie: string) => (await (await fetch(`${testApp.baseUrl}/api/auth/get-session`, { headers: { cookie } })).json()) as { session?: unknown } | null;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    userId = (await signUp(testApp.baseUrl, { email, password, name: "Sam Lee" })).userId;
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(verification).where(eq(verification.value, userId));
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("a valid link shows whose password it resets", async () => {
    const res = await lookup(await newToken());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email });
  });

  it("an unknown link is refused with 404", async () => {
    expect((await lookup(randomUUID())).status).toBe(404);
  });

  it("an expired link is refused and can't set a password", async () => {
    const token = await newToken();
    await db.update(verification).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(verification.identifier, `reset-password:${token}`));
    expect((await lookup(token)).status).toBe(404);
    expect((await post("/api/auth/reset-password", { token, newPassword: "anotherpass123" })).status).toBe(400);
    expect((await signIn(password)).status).toBe(200);
  });

  it("refuses a password shorter than 8 characters and leaves the old one", async () => {
    const token = await newToken();
    expect((await post("/api/auth/reset-password", { token, newPassword: "short" })).status).toBe(400);
    expect((await signIn(password)).status).toBe(200);
    expect((await lookup(token)).status).toBe(200);
  });

  it("sets the new password, ends every existing session, and the link works once", async () => {
    const before = await signIn(password);
    const cookie = (before.headers.get("set-cookie") ?? "").split(";")[0]!;
    expect((await sessionOf(cookie))?.session).toBeTruthy();

    const token = await newToken();
    const reset = await post("/api/auth/reset-password", { token, newPassword: "brandnewpass456" });
    expect(reset.status).toBe(200);

    expect((await sessionOf(cookie))?.session ?? null).toBeNull();
    expect(await db.select().from(session).where(eq(session.userId, userId))).toHaveLength(0);

    expect((await signIn(password)).status).toBe(401);
    expect((await signIn("brandnewpass456")).status).toBe(200);
    password = "brandnewpass456";

    // Single use.
    expect((await lookup(token)).status).toBe(404);
    expect((await post("/api/auth/reset-password", { token, newPassword: "thirdpassword789" })).status).toBe(400);
    expect((await signIn("brandnewpass456")).status).toBe(200);
  });
});
