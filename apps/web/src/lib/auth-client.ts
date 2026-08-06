import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

/**
 * Browser-side Better Auth client. Points at the API's own origin
 * (NEXT_PUBLIC_API_URL), not apps/web's own origin — the API process is
 * where Better Auth's handler actually lives (basePath "/api/auth" on the
 * NestJS app, see apps/api/src/auth/auth.ts). In dev these are different
 * ports (3000 vs 4000), so requests are cross-origin; Better Auth's client
 * sends `credentials: "include"` by default for a configured baseURL, and
 * the API's CORS (`enableCors({ origin: APP_URL, credentials: true })`)
 * allows it back. In prod, Caddy fronts both under one origin so this is a
 * same-origin request instead.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  plugins: [organizationClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
