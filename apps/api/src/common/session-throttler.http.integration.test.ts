import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../db/client";
import { user } from "../db/schema";
import { createTestApp, signUp, type TestApp } from "../test-utils/test-app";

const LIMIT = 300;

/**
 * Found during US-OPS-24: rate limits counted per IP, so the web app's
 * server (one address for every user) and offices behind one address were
 * throttled together. Signed-in requests now count per session; public
 * routes still count per IP. Requires local Postgres.
 */
describe("US-OPS-24 · rate limits count per session, public routes per IP (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];

  const burst = async (count: number, request: () => Promise<Response>) => {
    const statuses: number[] = [];
    for (let i = 0; i < count; i += 25) statuses.push(...(await Promise.all(Array.from({ length: Math.min(25, count - i) }, () => request().then((r) => r.status)))));
    return statuses;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  });

  afterAll(async () => {
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  async function member() {
    const email = `throttle-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Member" });
  }

  it("one person using up their limit doesn't throttle another on the same address", async () => {
    const [a, b] = [await member(), await member()];
    const asA = () => fetch(`${testApp.baseUrl}/contacts`, { headers: { cookie: a.cookie } });
    const statuses = await burst(LIMIT + 5, asA);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    expect((await fetch(`${testApp.baseUrl}/contacts`, { headers: { cookie: b.cookie } })).status).toBe(200);
  }, 60_000);

  it("a public route counts per address, whatever cookie is sent", async () => {
    const randomCookie = () => fetch(`${testApp.baseUrl}/public/signup-status`, { headers: { cookie: `better-auth.session_token=${randomUUID()}` } });
    const statuses = await burst(LIMIT + 5, randomCookie);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  }, 60_000);
});
