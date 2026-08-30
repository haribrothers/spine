import { createApiClient } from "@spine/sdk";
import { getSessionToken } from "./auth/token";

/**
 * The mobile counterpart to `apps/web/src/lib/api-client.ts` — same idea
 * (a thin fetch wrapper other screens call), backed by `@spine/sdk`'s
 * typed client instead of a hand-rolled one, and the session token (sent
 * as `Authorization: Bearer`, matching `apps/api/src/auth/auth.ts`'s
 * `bearer()` plugin) instead of a cookie. See `token.ts`'s own doc
 * comment for why this is the raw session token, not a minted JWT.
 */
export const apiClient = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000",
  getToken: getSessionToken,
});
