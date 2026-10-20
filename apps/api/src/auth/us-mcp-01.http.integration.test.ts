import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../db/client";
import { jwks, user } from "../db/schema";
import { createTestApp, signUp, type TestApp } from "../test-utils/test-app";
import { bearerSignIn, ownerWithFieldUser } from "../modules/mobile/field-user.test-helper";

/** US-MCP-01 (D-257) — Spine on Better Auth 1.7, with nothing anyone notices. Requires local Postgres. */
describe("US-MCP-01 · move Spine to Better Auth 1.7 with nobody noticing (requires local Postgres)", () => {
  let testApp: TestApp;
  const db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  const emails: string[] = [];

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 60_000);
  afterAll(async () => {
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  it("runs on Better Auth 1.7", () => {
    // The package doesn't export its package.json, so read the installed copy (tests run from apps/api).
    const version = (JSON.parse(readFileSync("node_modules/better-auth/package.json", "utf8")) as { version: string }).version;
    expect(version).toMatch(/^1\.7\./);
  });

  it("a web cookie and a phone's Bearer session both still work", async () => {
    const { fieldEmail } = await ownerWithFieldUser(testApp.baseUrl, db, emails);
    const { token } = await bearerSignIn(testApp.baseUrl, fieldEmail, "testpassword123");
    const byBearer = await fetch(`${testApp.baseUrl}/org/members/me`, { headers: { Authorization: `Bearer ${token}` } });
    expect(byBearer.status).toBe(200);

    const email = `us-mcp-01-${randomUUID()}@example.com`;
    emails.push(email);
    const { cookie } = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Priya Raman" });
    const byCookie = await fetch(`${testApp.baseUrl}/api/auth/get-session`, { headers: { cookie } });
    expect(((await byCookie.json()) as { user: { email: string } }).user.email).toBe(email);
  });

  it("keeps signing with a key made before the upgrade — no rotation forced", async () => {
    const email = `us-mcp-01-${randomUUID()}@example.com`;
    emails.push(email);
    const { cookie } = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Priya Raman" });
    const mint = async () => ((await (await fetch(`${testApp.baseUrl}/api/auth/token`, { headers: { cookie } })).json()) as { token: string }).token;

    await mint();
    // A 1.6 key had no alg or crv (migration 0129 adds them as null).
    await db.update(jwks).set({ alg: null, crv: null });
    const before = await db.select({ id: jwks.id }).from(jwks);

    const token = await mint();
    const keys = createRemoteJWKSet(new URL(`${testApp.baseUrl}/api/auth/jwks`));
    const { payload, protectedHeader } = await jwtVerify(token, keys);
    expect(protectedHeader.alg).toBe("EdDSA");
    expect(payload.email).toBe(email);
    expect((await db.select({ id: jwks.id }).from(jwks)).map((k) => k.id).sort()).toEqual(before.map((k) => k.id).sort());
    expect((await db.select().from(jwks).where(eq(jwks.id, before[0]!.id)))[0]).toMatchObject({ alg: null });
  });
});
