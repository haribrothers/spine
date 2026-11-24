import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../../db/client";
import { user } from "../../db/schema";
import { createTestApp, type TestApp } from "../../test-utils/test-app";
import { bearerSignIn, ownerWithFieldUser } from "./field-user.test-helper";

/** Requires the `db` service from docker-compose.dev.yml running locally. */
describe("US-MOB-01 · sign in to my company's Spine on my phone", () => {
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

  it("returns a bearer token the API accepts, landing in the Field member's organisation", async () => {
    const { fieldEmail, orgId, businessName } = await ownerWithFieldUser(testApp.baseUrl, db, emails);
    const { res, token } = await bearerSignIn(testApp.baseUrl, fieldEmail, "testpassword123");
    expect(res.status).toBe(200);
    expect(token).toBeTruthy();
    const me = await fetch(`${testApp.baseUrl}/org/members/me`, { headers: { Authorization: `Bearer ${token}` } });
    expect(me.status).toBe(200);
    const body = (await me.json()) as { role: string; name: string; organizationName: string };
    expect(body.role).toBe("field");
    expect(body.name).toBe("Marcus Webb");
    expect(body.organizationName).toBe(businessName);
    const session = await fetch(`${testApp.baseUrl}/api/auth/get-session`, { headers: { Authorization: `Bearer ${token}` } });
    expect(((await session.json()) as { session: { activeOrganizationId: string } }).session.activeOrganizationId).toBe(orgId);
  });

  it("rejects wrong credentials with \"Invalid email or password\"", async () => {
    const { fieldEmail } = await ownerWithFieldUser(testApp.baseUrl, db, emails);
    const { res, token } = await bearerSignIn(testApp.baseUrl, fieldEmail, "not-the-password");
    expect(res.status).toBe(401);
    expect(token).toBeNull();
    expect(((await res.json()) as { message: string }).message).toMatch(/invalid email or password/i);
  });
});

describe("US-MOB-01 · the server address is checked before signing in", () => {
  let testApp: TestApp;
  beforeAll(async () => {
    testApp = await createTestApp();
  });
  afterAll(async () => {
    await testApp.close();
  });

  it("answers /health with the service name and where the web app lives", async () => {
    const res = await fetch(`${testApp.baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string; appUrl: string | null };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("spine");
    expect(body).toHaveProperty("appUrl");
  });
});
