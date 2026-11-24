import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/** US-ONB-14 — the industry template starts a new organisation with the modules it needs. Requires local Postgres. */
describe("US-ONB-14 · start with the modules my industry needs (requires local Postgres)", () => {
  let testApp: TestApp;

  const owner = async () => (await signUp(testApp.baseUrl, { email: `us-onb-14-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" })).cookie;
  const call = (cookie: string, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const template = async (cookie: string, value: string) => expect((await call(cookie, "PUT", "/org/settings/industry_template", { value: { template: value } })).status).toBeLessThan(300);
  const modules = async (cookie: string) => (await (await call(cookie, "GET", "/org/modules")).json()) as Record<string, boolean>;

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("Construction / Contracting and General Services switch every module on", async () => {
    for (const value of ["construction", "general_services"]) {
      const cookie = await owner();
      await template(cookie, value);
      expect(await modules(cookie)).toEqual({ leadsMeetings: true, jobsField: true, approvals: true, recurring: true });
    }
  });

  it("Generic starts with Jobs & field off", async () => {
    const cookie = await owner();
    await template(cookie, "generic");
    expect(await modules(cookie)).toEqual({ leadsMeetings: true, jobsField: false, approvals: true, recurring: true });
    expect((await call(cookie, "GET", "/jobs")).status).toBe(403);
  });

  it("changing the template later leaves the modules as they are", async () => {
    const cookie = await owner();
    await template(cookie, "generic");
    await template(cookie, "construction");
    expect((await modules(cookie)).jobsField).toBe(false);
    await call(cookie, "PUT", "/org/modules", { leadsMeetings: true, jobsField: true, approvals: false, recurring: true });
    await template(cookie, "generic");
    expect(await modules(cookie)).toMatchObject({ jobsField: true, approvals: false });
  });
});
