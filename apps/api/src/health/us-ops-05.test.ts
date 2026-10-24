import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../db/client";
import type { QueueService } from "../modules/queue/queue.service";
import { HealthService } from "./health.service";

/** One top-level service's block from docker-compose.yml, by indentation (no YAML parser in the API's dependencies). */
function composeService(name: string): string {
  const compose = readFileSync(resolve(process.cwd(), "../../docker-compose.yml"), "utf8");
  const lines = compose.split("\n");
  const start = lines.indexOf(`  ${name}:`);
  expect(start, `service ${name}`).toBeGreaterThan(-1);
  const end = lines.findIndex((l, i) => i > start && /^ {2}\S/.test(l));
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

describe("US-OPS-05 · report health and readiness", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a check that doesn't answer within 3 seconds counts as down, so the healthcheck never hangs", async () => {
    vi.useFakeTimers();
    const hanging = new Promise<never>(() => {});
    const health = new HealthService({ execute: () => hanging } as unknown as Database, { reachable: () => hanging } as unknown as QueueService);
    const checks = Promise.all([health.database(), health.jobQueue()]);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(checks).resolves.toEqual([false, false]);
  });

  it("Docker Compose checks the API's readiness, and web waits for it", () => {
    const api = composeService("api");
    expect(api).toMatch(/healthcheck:\n\s+test: \[.*\/health\/ready.*\]/);
    const web = composeService("web");
    expect(web).toMatch(/depends_on:\n\s+api:\n\s+condition: service_healthy/);
  });
});
