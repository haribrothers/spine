import { authClient } from "./auth-client";

/**
 * Corrected auth-flow design (see CHANGELOG's Phase 5 Stage 4 entry for
 * how this was discovered — a live 401 against a real endpoint, not a
 * typecheck): `@spine/sdk`'s `createApiClient` needs a bare Bearer token
 * to attach to requests it makes itself, but `expoClient`'s own internal
 * requests (`authClient.signIn`/`useSession`/etc.) send the session as a
 * `Cookie:` header, not `Authorization: Bearer` — `getCookie()` is the
 * only session-token accessor `expoClient` exposes, returning a
 * `name=value; name2=value2`-style cookie string, so the session token's
 * value is extracted from it here for the (unrelated) Bearer path
 * `apps/api/src/auth/auth.ts`'s `bearer()` plugin expects.
 *
 * The extracted value is Better Auth's SIGNED session cookie
 * (`<token>.<hmac-signature>`, e.g.
 * `tWM5...LR.XooK.../q9RMI=` — captured and verified against a live
 * sign-up response's actual `Set-Cookie` header, not assumed), not the
 * bare unsigned token — the `bearer()` plugin's own `token.includes(".")`
 * branch verifies this signed form directly rather than expecting it
 * re-signed. Also confirmed empirically (not just by reading source) that
 * `@better-auth/expo`'s `parseSetCookieHeader` already URL-decodes the
 * cookie value before `getCookie()` returns it (`%2F`→`/`, `%3D`→`=`), so
 * no additional decoding is needed here — a real, live-verified round
 * trip: sign up → capture the raw `Set-Cookie` → send that exact
 * (decoded) value as `Authorization: Bearer` → 200 with real capability
 * data back, on `apps/api`'s actual running instance.
 *
 * No caching needed — `getCookie()` just reads from SecureStore
 * synchronously each time, no network round trip like the original
 * (incorrect) JWT-minting design this replaced.
 */
export function getSessionToken(): string | null {
  const cookie = authClient.getCookie();
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)[^=;]*session_token=([^;]+)/);
  return match?.[1] ?? null;
}
