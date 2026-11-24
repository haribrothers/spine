import { join } from "node:path";
import type { NextConfig } from "next";

/**
 * US-OPS-18 (security review) — every page: never framed (clickjacking), no
 * MIME sniffing, the origin only as referrer, and no camera, microphone or
 * location for the page. HSTS when the app is served over HTTPS.
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(process.env.APP_URL?.startsWith("https://") ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // US-SITE-12: the bundled guide (public/help, built from apps/docs) is folders of index.html.
  async rewrites() {
    return { beforeFiles: [], afterFiles: [{ source: "/help", destination: "/help/index.html" }, { source: "/help/:path*", destination: "/help/:path*/index.html" }], fallback: [] };
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // E2E builds use their own folder so they never clash with a running `pnpm dev` (which owns `.next`).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@spine/ui", "@spine/shared"],
  // US-OPS-01: the Docker image runs Next.js's standalone server (NEXT_OUTPUT=standalone in
  // docker/Dockerfile.web), traced from the monorepo's root; `next start` is unchanged elsewhere.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const, outputFileTracingRoot: join(__dirname, "../..") } : {}),
};

export default nextConfig;
