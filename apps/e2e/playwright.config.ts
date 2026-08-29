import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke suite (CLAUDE.md's testing-expectations section: "E2E smoke
 * test covering quote → invoice → payment"). Boots real apps/api and
 * apps/web instances (via Playwright's own `webServer`, not mocks) against
 * a dedicated scratch database (.env.e2e, same "own DB, tests TRUNCATE
 * real tables" reasoning as .env.test — see that file's own comment) on
 * ports offset from local dev's 3000/4000 (3100/4100) so this suite can
 * run alongside a normal `pnpm dev` session without a port clash.
 *
 * `webServer` runs migrations before starting each app (idempotent — safe
 * to re-run against an already-migrated DB), so a fresh checkout needs no
 * manual setup beyond `createdb spine_e2e` once (see .env.e2e's own
 * comment) and docker-compose.dev.yml's `db`/`maildev` services running.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @spine/api build && pnpm --filter @spine/api db:migrate:e2e && pnpm --filter @spine/api start:e2e",
      url: "http://localhost:4100/health",
      cwd: "../..",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "pnpm --filter @spine/web build:e2e && pnpm --filter @spine/web start:e2e",
      url: "http://localhost:3100",
      cwd: "../..",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
