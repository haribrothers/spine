import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** Unit tests for the web app's own logic and pages; the full flows are the Playwright suite (apps/e2e). */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
