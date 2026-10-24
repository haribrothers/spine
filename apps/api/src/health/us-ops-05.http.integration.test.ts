import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestApp, type TestApp } from "../test-utils/test-app";
import { QueueService } from "../modules/queue/queue.service";
import { HealthService } from "./health.service";

/** US-OPS-05 — health and readiness for Docker and monitors. Requires local Postgres. */
describe("US-OPS-05 · report health and readiness (requires local Postgres)", () => {
  let testApp: TestApp;
  const get = (path: string) => fetch(`${testApp.baseUrl}${path}`);

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 60_000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("GET /health answers 200 { status: \"ok\" } while the process runs", async () => {
    const res = await get("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
  });

  it("GET /health/ready answers 200 when the database and the job queue are reachable, without signing in", async () => {
    const res = await get("/health/ready");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", database: "ok", queue: "ok", storage: { driver: expect.any(String) } });
  });

  it("answers 503 naming the database when it isn't reachable", async () => {
    vi.spyOn(testApp.app.get(HealthService), "database").mockResolvedValue(false);
    const res = await get("/health/ready");
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: "unavailable", database: "unreachable", queue: "ok", message: "The database isn't reachable." });
  });

  it("answers 503 naming the job queue when pg-boss isn't running", async () => {
    vi.spyOn(testApp.app.get(QueueService), "reachable").mockResolvedValue(false);
    const res = await get("/health/ready");
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ database: "ok", queue: "unreachable", message: "The job queue isn't reachable." });
  });

  it("names both when neither is reachable", async () => {
    vi.spyOn(testApp.app.get(HealthService), "database").mockResolvedValue(false);
    vi.spyOn(testApp.app.get(HealthService), "jobQueue").mockResolvedValue(false);
    const res = await get("/health/ready");
    expect(res.status).toBe(503);
    expect(((await res.json()) as { message: string }).message).toBe("The database and the job queue aren't reachable.");
  });
});
