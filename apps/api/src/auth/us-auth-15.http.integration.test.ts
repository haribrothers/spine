import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PASSWORD_TOO_COMMON_MESSAGE } from "@spine/shared";
import { createDb, type Database } from "../db/client";
import { user } from "../db/schema";
import { createTestApp, signUp, type TestApp } from "../test-utils/test-app";

/**
 * US-AUTH-15 (D-207) — the server refuses the most common passwords
 * wherever one is chosen (sign-up, reset, change), with
 * `PASSWORD_TOO_COMMON`; the 8-character minimum is unchanged. Requires
 * local Postgres.
 */
describe("US-AUTH-15 · choose a strong password I can see (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const createdEmails: string[] = [];
  const post = (path: string, body: unknown, cookie?: string) =>
    fetch(`${testApp.baseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  });

  afterAll(async () => {
    await testApp?.close();
    if (createdEmails.length) await db.delete(user).where(inArray(user.email, createdEmails));
  });

  it("refuses a common password at sign-up, and creates no account", async () => {
    const email = `us-auth-15-common-${randomUUID()}@example.com`;
    createdEmails.push(email);
    const res = await post("/api/auth/sign-up/email", { email, password: "Password123", name: "Common" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "PASSWORD_TOO_COMMON", message: PASSWORD_TOO_COMMON_MESSAGE });
    expect((await db.select().from(user).where(inArray(user.email, [email]))).length).toBe(0);
  });

  it("refuses a common password when it's changed or reset", async () => {
    const email = `us-auth-15-change-${randomUUID()}@example.com`;
    createdEmails.push(email);
    const { cookie } = await signUp(testApp.baseUrl, { email, password: "Harbour-view-2026", name: "Changer" });
    const change = await post("/api/auth/change-password", { currentPassword: "Harbour-view-2026", newPassword: "qwerty123" }, cookie);
    expect(change.status).toBe(400);
    expect(await change.json()).toMatchObject({ code: "PASSWORD_TOO_COMMON" });
    // The check runs before the token is looked at, so a made-up token shows it too.
    const reset = await post("/api/auth/reset-password", { token: "made-up", newPassword: "iloveyou" });
    expect(reset.status).toBe(400);
    expect(await reset.json()).toMatchObject({ code: "PASSWORD_TOO_COMMON" });
  });

  it("accepts an uncommon password, however weak the meter calls it", async () => {
    const email = `us-auth-15-ok-${randomUUID()}@example.com`;
    createdEmails.push(email);
    const res = await post("/api/auth/sign-up/email", { email, password: "riverstone", name: "Fine" });
    expect(res.status).toBe(200);
  });

  it("tells the welcome page apart from tests' open sign-up (US-AUTH-13)", async () => {
    const status = (await (await fetch(`${testApp.baseUrl}/public/signup-status`)).json()) as { newInstall: boolean };
    expect(status.newInstall).toBe(false);
  });
});
