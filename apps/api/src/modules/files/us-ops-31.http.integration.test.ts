import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { createTestApp, type TestApp } from "../../test-utils/test-app";

/** US-OPS-31 — `/health/ready` reports file storage. Requires local Postgres. */
describe("US-OPS-31 · /health/ready reports storage (requires local Postgres)", () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("includes the storage driver and how full the files volume is, without signing in", async () => {
    const res = await fetch(`${testApp.baseUrl}/health/ready`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { storage: { driver: string; usedPercent: number | null } };
    expect(body.storage.driver).toBe("local");
    expect(typeof body.storage.usedPercent).toBe("number");
  });
});
