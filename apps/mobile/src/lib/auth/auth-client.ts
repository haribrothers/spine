import * as SecureStore from "expo-secure-store";
import { createAuthClient } from "better-auth/react";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { expoClient } from "@better-auth/expo/client";
import { organizationClient } from "better-auth/client/plugins";

/**
 * Mobile's Better Auth client — the counterpart to
 * `apps/web/src/lib/auth-client.ts`, using `expoClient` (`@better-auth/expo`)
 * instead of the plain cookie-based browser client. `expoClient`'s own
 * `storage` option is caller-supplied, not auto-wired — it persists the
 * session token via `expo-secure-store` and attaches it as a `Cookie:`
 * header on every request THIS client itself makes (`signIn`/`signUp`/
 * `useSession`/etc. — confirmed by reading `@better-auth/expo`'s own
 * source, not just its types), which is what makes "log in once, stay
 * logged in" (S-11.1) work: the session itself is long-lived (30 days /
 * 7-day rolling refresh, see apps/api/src/auth/auth.ts), so no explicit
 * refresh step is needed here at all.
 *
 * `@spine/sdk`'s OWN client (`../api-client.ts`) is a separate `fetch`
 * caller, not routed through `authClient` — it needs the bare session
 * token as `Authorization: Bearer` instead, via `token.ts`'s
 * `getSessionToken()`, matching `apps/api/src/auth/auth.ts`'s `bearer()`
 * plugin. No JWT is minted or used anywhere in this flow — an earlier
 * version of this file assumed `jwt()`/`jwtClient()` was the mechanism
 * (matching the PRD's original "JWT for mobile" phrasing), but the API's
 * `AuthGuard` only ever verifies a session (cookie or `bearer()`-sent
 * token), never a `jwt()`-minted JWT — a real design correction found via
 * a live 401 against a real endpoint, not a typecheck. See CHANGELOG's
 * Phase 5 Stage 4 entry for the full corrected design.
 *
 * `@better-auth/expo` is pinned to the exact `better-auth` version
 * `apps/api` resolves (1.6.26) — the two packages' versions track each
 * other 1:1 (confirmed against npm before picking a version), and a
 * mismatch here would be a real, hard-to-diagnose runtime failure, not
 * just a type error.
 */
export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  plugins: [
    // `as BetterAuthClientPlugin` below works around a pnpm-monorepo-
    // specific TS friction: @better-auth/expo and this app's own
    // `better-auth` resolve to the SAME version (1.6.26, confirmed) but
    // as two structurally-distinct package instances (pnpm's isolated
    // node_modules gives each unique dependency-hash combination its own
    // physical copy even at identical versions), so TS's generic
    // inference across the plugin array's BetterFetch type parameter
    // fails to unify even though the runtime values are byte-identical.
    // A known class of issue with deeply-generic libraries in pnpm
    // monorepos, not a real type mismatch — verified both resolved
    // copies are literally version 1.3.1 of @better-fetch/fetch before
    // reaching for a widening cast to the plugin base type (not a
    // specific other plugin's shape, which would misrepresent this
    // plugin's actual actions/options) instead of chasing the
    // resolution graph further.
    expoClient({
      scheme: "spine",
      storagePrefix: "spine",
      storage: SecureStore,
    }) as BetterAuthClientPlugin,
    organizationClient(),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;
