import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ACCESS_REMOVED_ERROR } from "@spine/shared";
import { createDb } from "../../db/client";
import { user } from "../../db/schema";
import { createTestApp, type TestApp } from "../../test-utils/test-app";
import { bearerSignIn, ownerWithFieldUser } from "./field-user.test-helper";

/** Requires the `db` service from docker-compose.dev.yml running locally. */
describe("US-MOB-02 · stay signed in and sign out safely", () => {
  let testApp: TestApp;
  const db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  const emails: string[] = [];

  beforeAll(async () => {
    testApp = await createTestApp();
  });
  afterAll(async () => {
    await testApp.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  it("signs a deactivated member out with \"Your access to <Business> was removed.\" on every route", async () => {
    const { fieldEmail, fieldMemberId, ownerCookie, businessName } = await ownerWithFieldUser(testApp.baseUrl, db, emails);
    const { token } = await bearerSignIn(testApp.baseUrl, fieldEmail, "testpassword123");
    const auth = { Authorization: `Bearer ${token}` };
    expect((await fetch(`${testApp.baseUrl}/jobs?assignedToMe=true`, { headers: auth })).status).toBe(200);

    const deactivate = await fetch(`${testApp.baseUrl}/org/members/${fieldMemberId}/deactivate`, {
      method: "PUT",
      headers: { cookie: ownerCookie, "Idempotency-Key": randomUUID() },
    });
    expect(deactivate.status).toBe(200);

    for (const path of ["/org/members/me", "/jobs?assignedToMe=true", "/expenses?mine=true", "/users/me"]) {
      const res = await fetch(`${testApp.baseUrl}${path}`, { headers: auth });
      expect(res.status, path).toBe(403);
      const body = (await res.json()) as { error: string; message: string };
      expect(body.error).toBe(ACCESS_REMOVED_ERROR);
      expect(body.message).toBe(`Your access to ${businessName} was removed.`);
    }
  });

  it("keeps the owner's own access working", async () => {
    const { ownerCookie } = await ownerWithFieldUser(testApp.baseUrl, db, emails);
    expect((await fetch(`${testApp.baseUrl}/org/members/me`, { headers: { cookie: ownerCookie } })).status).toBe(200);
  });

  it("revokes the session on sign-out, so the token stops working", async () => {
    const { fieldEmail } = await ownerWithFieldUser(testApp.baseUrl, db, emails);
    const { token } = await bearerSignIn(testApp.baseUrl, fieldEmail, "testpassword123");
    const auth = { Authorization: `Bearer ${token}` };
    const out = await fetch(`${testApp.baseUrl}/api/auth/sign-out`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: "{}" });
    expect(out.status).toBe(200);
    expect((await fetch(`${testApp.baseUrl}/org/members/me`, { headers: auth })).status).toBe(401);
  });
});
