import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/**
 * US-SITE-06 — `pnpm --filter @spine/e2e screenshots`: captures every screen
 * the guide lists (apps/docs/screenshots/*.json) from a demo-seeded install,
 * light and dark, into apps/docs/src/assets/screens/. Same servers as the
 * E2E suite.
 */
export default defineConfig({
  ...base,
  testDir: "./screenshots",
  testMatch: /capture\.spec\.ts$/,
  retries: 0,
  timeout: 30 * 60_000,
  projects: [{ name: "screenshots", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
});
