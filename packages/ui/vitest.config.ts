import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // The first axe run in a file can take over 5 s when every package tests at once (pnpm verify, CI);
    // a timeout there also leaves axe running and fails the file's next test.
    testTimeout: 60_000,
  },
});
