import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, signUp, type TestApp } from "../test-utils/test-app";

/**
 * US-OPS-18 (D-267) — the public quote and invitation routes: their tokens
 * can't be enumerated (every wrong token gets the same answer), and their
 * rate limits hold per visitor behind the reverse proxy. Requires local
 * Postgres.
 */
describe("US-OPS-18 · public routes resist enumeration and rate limits hold (requires local Postgres)", () => {
  let testApp: TestApp;
  let cookie: string;
  /** A fresh visitor address each test, as the proxy (Caddy) reports it. */
  const visitor = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
  const get = (path: string, ip: string) => fetch(`${testApp.baseUrl}${path}`, { headers: { "X-Forwarded-For": ip } });
  const api = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { cookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

  beforeAll(async () => {
    testApp = await createTestApp();
    ({ cookie } = await signUp(testApp.baseUrl, { email: `us-ops-18-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" }));
  }, 60_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("a guessed, malformed or tampered quote token gets the same 404, and a real one still works", async () => {
    const c = (await (await api("POST", "/contacts", { type: "customer", name: "Harbour Café" })).json()) as { id: string };
    const q = (await (await api("POST", "/quotes", { contactId: c.id, currency: "USD", lines: [{ type: "item", name: "Visit", quantity: 1, unitPriceAmount: "10000" }] })).json()) as { id: string };
    await api("POST", `/quotes/${q.id}/send`, {});
    const link = (await (await api("POST", `/quotes/${q.id}/link`)).json()) as { url: string };
    const token = decodeURIComponent(link.url.split("/quote/")[1]!);
    const ip = visitor();

    expect((await get(`/public/quotes/${encodeURIComponent(token)}`, ip)).status).toBe(200);
    const tampered = token.slice(0, -4) + (token.endsWith("AAAA") ? "BBBB" : "AAAA");
    const answers = [];
    for (const guess of [randomBytes(32).toString("base64url"), "not-a-token", tampered, `${token}x`]) {
      const res = await get(`/public/quotes/${encodeURIComponent(guess)}`, ip);
      answers.push({ status: res.status, body: await res.text() });
    }
    expect(answers.map((a) => a.status)).toEqual([404, 404, 404, 404]);
    expect(new Set(answers.map((a) => a.body)).size).toBe(1);
  });

  it("a guessed invitation id gets the same 404, and invitation ids are 32 random characters (about 190 bits)", async () => {
    const ip = visitor();
    const bodies = new Set<string>();
    for (const guess of [randomUUID(), randomUUID(), "1", "admin"]) {
      const res = await get(`/public/invitations/${guess}`, ip);
      expect(res.status).toBe(404);
      bodies.add(await res.text());
    }
    expect(bodies.size).toBe(1);
    const invite = (await (await fetch(`${testApp.baseUrl}/api/auth/organization/invite-member`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json", Origin: process.env.APP_URL ?? "http://localhost:3000" },
      body: JSON.stringify({ email: `invitee-${randomUUID()}@example.com`, role: "staff" }),
    })).json()) as { id?: string };
    // Better Auth's generateId: 32 characters of [A-Za-z0-9].
    expect(invite.id).toMatch(/^[A-Za-z0-9]{32}$/);
  });

  it("public quote and invitation lookups stop at 20 a minute per visitor; another visitor isn't affected", async () => {
    for (const path of ["/public/quotes/not-a-token", `/public/invitations/${randomUUID()}`]) {
      const ip = visitor();
      for (let i = 0; i < 20; i++) expect((await get(path, ip)).status).toBe(404);
      expect((await get(path, ip)).status).toBe(429);
      expect((await get(path, visitor())).status).toBe(404);
    }
  });

  it("every API response says not to sniff, frame or send a referrer, and doesn't name the framework", async () => {
    const res = await get("/health/live", visitor());
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });
});
