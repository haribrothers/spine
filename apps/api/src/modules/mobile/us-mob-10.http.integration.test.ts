import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CLIENT_TOO_OLD_ERROR, CLIENT_VERSION_HEADER } from "@spine/shared";
import { createDb } from "../../db/client";
import { user } from "../../db/schema";
import { createTestApp, type TestApp } from "../../test-utils/test-app";
import { bearerSignIn, ownerWithFieldUser } from "./field-user.test-helper";

/** Requires the `db` service from docker-compose.dev.yml running locally. */
describe("US-MOB-10 · an app older than MOBILE_MIN_VERSION gets 426", () => {
  let testApp: TestApp;
  const db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  const emails: string[] = [];
  let auth: Record<string, string>;

  beforeAll(async () => {
    testApp = await createTestApp();
    const { fieldEmail } = await ownerWithFieldUser(testApp.baseUrl, db, emails);
    const { token } = await bearerSignIn(testApp.baseUrl, fieldEmail, "testpassword123");
    auth = { Authorization: `Bearer ${token}` };
  });
  afterEach(() => {
    delete process.env.MOBILE_MIN_VERSION;
  });
  afterAll(async () => {
    await testApp.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  const call = (version?: string) =>
    fetch(`${testApp.baseUrl}/org/members/me`, { headers: { ...auth, ...(version ? { [CLIENT_VERSION_HEADER]: version } : {}) } });

  it("answers 426 CLIENT_TOO_OLD below the minimum", async () => {
    process.env.MOBILE_MIN_VERSION = "1.2.0";
    const res = await call("1.1.9");
    expect(res.status).toBe(426);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe(CLIENT_TOO_OLD_ERROR);
    expect(body.message).toBe("Update Spine to keep going");
  });

  it("lets the minimum and newer through", async () => {
    process.env.MOBILE_MIN_VERSION = "1.2.0";
    expect((await call("1.2.0")).status).toBe(200);
    expect((await call("1.10.0")).status).toBe(200);
  });

  it("never affects requests without the header, or a server without a minimum", async () => {
    process.env.MOBILE_MIN_VERSION = "1.2.0";
    expect((await call()).status).toBe(200);
    delete process.env.MOBILE_MIN_VERSION;
    expect((await call("0.0.1")).status).toBe(200);
  });
});
