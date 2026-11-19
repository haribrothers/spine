import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke suite (CLAUDE.md's testing-expectations section: "E2E smoke
 * test covering quote → invoice → payment"). Boots real apps/api and
 * apps/web instances (via Playwright's own `webServer`, not mocks) against
 * a dedicated scratch database (.env.e2e, same "own DB, tests TRUNCATE
 * real tables" reasoning as .env.test — see that file's own comment) on
 * ports 3110/4110 — clear of local dev (web 3000, API 4000, design-system
 * docs 3100) — so this suite can
 * run alongside a normal `pnpm dev` session without a port clash.
 *
 * `webServer` runs migrations before starting each app (idempotent — safe
 * to re-run against an already-migrated DB), so a fresh checkout needs no
 * manual setup beyond `createdb spine_e2e` once (see .env.e2e's own
 * comment) and docker-compose.dev.yml's `db`/`maildev` services running.
 */
/** US-ONB-17, US-ONB-18 — specs that load or delete demo data outside `seededOrg`. */
const DEMO_DATA_SPECS = /us-onb-1[78]\.spec\.ts$/;
/** US-OPS-62 — the every-route check that runs on a phone (NFR-COMP-02). */
const PHONE_SPECS = /us-ops-62\.spec\.ts$/;
/** US-OPS-62: a phone, 390×844 with touch (`pointer: coarse`) and a phone user agent, in Chromium. */
const PHONE_DEVICE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
};

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A broken branch fails the same way everywhere: stop after five failures
  // instead of spending Actions minutes on the rest of the suite.
  maxFailures: process.env.CI ? 5 : 0,
  workers: 1,
  // The HTML report is the artifact CI uploads when the job fails.
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3110",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [DEMO_DATA_SPECS, PHONE_SPECS],
    },
    {
      name: "phone",
      use: { ...devices["Desktop Chrome"], ...PHONE_DEVICE },
      testMatch: PHONE_SPECS,
    },
    // Specs that load or delete demo data of their own run last (after the phone check too): the demo Staff and Field
    // logins follow the latest demo, and every other spec expects them in `seededOrg`.
    {
      name: "demo-data",
      use: { ...devices["Desktop Chrome"] },
      testMatch: DEMO_DATA_SPECS,
      dependencies: ["chromium", "phone"],
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @spine/api build && pnpm --filter @spine/api db:migrate:e2e && pnpm --filter @spine/api start:e2e",
      url: "http://localhost:4110/health",
      cwd: "../..",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // US-SITE-12: the bundled guide (/help) is built into the web app first.
      command: "pnpm --filter @spine/docs build:help && pnpm --filter @spine/web build:e2e && pnpm --filter @spine/web start:e2e",
      url: "http://localhost:3110",
      cwd: "../..",
      reuseExistingServer: !process.env.CI,
      // The guide plus a production build of the web app take about four minutes from cold.
      timeout: 420_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
