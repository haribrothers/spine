import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-RPT-23 — favourite reports are kept on the member, so they follow them to every device. Requires local Postgres. */
describe("US-RPT-23 · favourite reports (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  const a: Who = { cookie: "", userId: "" };
  const b: Who = { cookie: "", userId: "" };
  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[a, "a"], [b, "b"]] as const) {
      const email = `us-rpt-23-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("starts empty, keeps the order starred, drops unknown or repeated reports, and is per person", async () => {
    expect(await (await call(a, "GET", "/users/me/favourite-reports")).json()).toEqual({ slugs: [] });
    const saved = await (await call(a, "PUT", "/users/me/favourite-reports", { slugs: ["tax-summary", "profit-and-loss", "no-such-report", "tax-summary"] })).json();
    expect(saved).toEqual({ slugs: ["tax-summary", "profit-and-loss"] });
    expect(await (await call(a, "GET", "/users/me/favourite-reports")).json()).toEqual({ slugs: ["tax-summary", "profit-and-loss"] });
    expect(await (await call(b, "GET", "/users/me/favourite-reports")).json()).toEqual({ slugs: [] });
  });
});
