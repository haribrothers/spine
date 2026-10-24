import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// JSON lines and request logging, as in production, before the logger loads (put back afterwards).
const before = vi.hoisted(() => {
  const saved = { format: process.env.LOG_FORMAT, requests: process.env.LOG_REQUESTS };
  process.env.LOG_FORMAT = "json";
  process.env.LOG_REQUESTS = "on";
  return saved;
});

import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Line = Record<string, unknown>;

/** US-OPS-07 — structured request logs with an id, and nothing secret in them. Requires local Postgres. */
describe("US-OPS-07 · log every request with an id (requires local Postgres)", () => {
  let testApp: TestApp;
  let written: string[] = [];
  const lines = (): Line[] => written.flatMap((chunk) => chunk.split("\n")).filter((l) => l.startsWith("{")).map((l) => JSON.parse(l) as Line);
  const requestLines = () => lines().filter((l) => l.context === "Request");

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 60_000);

  beforeEach(() => {
    written = [];
    const write = process.stdout.write.bind(process.stdout);
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array, ...rest: unknown[]) => {
      written.push(String(chunk));
      return write(chunk, ...(rest as []));
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    for (const [key, value] of [["LOG_FORMAT", before.format], ["LOG_REQUESTS", before.requests]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("every response carries an X-Request-Id, and its log line is JSON with timestamp, level, id, method, path, status and duration", async () => {
    const res = await fetch(`${testApp.baseUrl}/health`);
    const id = res.headers.get("x-request-id");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await vi.waitFor(() => expect(requestLines().find((l) => l.requestId === id)).toBeDefined());
    const line = requestLines().find((l) => l.requestId === id)!;
    expect(line).toMatchObject({ level: "info", method: "GET", path: "/health", status: 200, durationMs: expect.any(Number) });
    expect(Number.isNaN(Date.parse(line.time as string))).toBe(false);
  });

  it("keeps an id the caller sent, so a proxy's id and Spine's match", async () => {
    const res = await fetch(`${testApp.baseUrl}/health`, { headers: { "X-Request-Id": "caddy-7f3a9c2e" } });
    expect(res.headers.get("x-request-id")).toBe("caddy-7f3a9c2e");
    await vi.waitFor(() => expect(requestLines().some((l) => l.requestId === "caddy-7f3a9c2e")).toBe(true));
  });

  it("a refused request is logged as a warning", async () => {
    const res = await fetch(`${testApp.baseUrl}/invoices`);
    expect(res.status).toBe(401);
    const id = res.headers.get("x-request-id");
    await vi.waitFor(() => expect(requestLines().find((l) => l.requestId === id)).toMatchObject({ level: "warn", status: 401, path: "/invoices" }));
  });

  it("signing in and failing to sign in log no password, token or cookie, and no query string", async () => {
    const email = `us-ops-07-${Date.now()}@example.com`;
    const { cookie } = await signUp(testApp.baseUrl, { email, password: "a-Very-Secret-pass1", name: "Priya Raman" });
    await fetch(`${testApp.baseUrl}/api/auth/sign-in/email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "wrong-Secret-pass2" }) });
    await fetch(`${testApp.baseUrl}/health?token=leak-me-123`, { headers: { cookie } });
    await vi.waitFor(() => expect(requestLines().filter((l) => String(l.path).startsWith("/api/auth/")).length).toBeGreaterThanOrEqual(2));
    const all = written.join("");
    for (const secret of ["a-Very-Secret-pass1", "wrong-Secret-pass2", "leak-me-123", cookie.split("=")[1]!.split(";")[0]!]) expect(all).not.toContain(secret);
  });
});
