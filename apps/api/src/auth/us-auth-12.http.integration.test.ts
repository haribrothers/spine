import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../test-utils/test-app";

/**
 * US-AUTH-12 — the web app opens "You've been signed out" on a 401 and the
 * permission toast on a 403, so a request with no session must be 401 on
 * every kind of route, including capability-gated ones. Requires local
 * Postgres.
 */
describe("US-AUTH-12 · a request with no session is 401, never 403 (requires local Postgres)", () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const call = (method: string, path: string, cookie?: string) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), ...(cookie ? { cookie } : {}) },
      body: method === "GET" ? undefined : JSON.stringify({ type: "customer", name: "Draft" }),
    });

  it.each([
    ["POST", "/contacts"], // capability-gated (contacts.edit_own)
    ["GET", "/contacts"],
    ["POST", "/quotes"],
    ["GET", "/notifications/unread-count"],
  ])("%s %s without a session → 401", async (method, path) => {
    expect((await call(method, path)).status).toBe(401);
  });

  it("an expired or unknown session cookie → 401", async () => {
    expect((await call("POST", "/contacts", "better-auth.session_token=not-a-real-session")).status).toBe(401);
  });
});
