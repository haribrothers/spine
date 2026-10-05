import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E builds use their own folder so they never clash with a running `pnpm dev` (which owns `.next`).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@spine/ui", "@spine/shared"],
};

export default nextConfig;
