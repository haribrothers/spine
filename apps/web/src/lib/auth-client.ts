import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { authOrigin } from "./public-api-url";

/**
 * Browser-side Better Auth client. Points at the API's own origin
 * (NEXT_PUBLIC_API_URL), not apps/web's own origin — the API process is
 * where Better Auth's handler actually lives (basePath "/api/auth" on the
 * NestJS app, see apps/api/src/auth/auth.ts). In dev these are different
 * ports (3000 vs 4000), so requests are cross-origin; Better Auth's client
 * sends `credentials: "include"` by default for a configured baseURL, and
 * the API's CORS (`enableCors({ origin: APP_URL, credentials: true })`)
 * allows it back. In prod, Caddy fronts both under one origin so this is a
 * same-origin request instead: release images are built with the path
 * `/api`, and sign-in goes to the page's own origin + `/api/auth`, which
 * Caddy passes to the API unchanged (US-OPS-01, US-OPS-51, public-api-url.ts).
 */
export const authClient = createAuthClient({
  baseURL: authOrigin(),
  // US-MCP-03: on a page an agent's sign-in sent people to, requests carry its signed query so the flow continues.
  plugins: [organizationClient(), oauthProviderClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
