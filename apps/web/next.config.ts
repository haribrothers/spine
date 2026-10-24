import { join } from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E builds use their own folder so they never clash with a running `pnpm dev` (which owns `.next`).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@spine/ui", "@spine/shared"],
  // US-OPS-01: the Docker image runs Next.js's standalone server (NEXT_OUTPUT=standalone in
  // docker/Dockerfile.web), traced from the monorepo's root; `next start` is unchanged elsewhere.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const, outputFileTracingRoot: join(__dirname, "../..") } : {}),
};

export default nextConfig;
