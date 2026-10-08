import { apiRequest, isOnline, type OnlineCheck } from "../api/request";
import { apiBaseCandidates, authUrl, normalizeServerAddress } from "../server-address";
import { APP_VERSION } from "../app-version";
import { CLIENT_VERSION_HEADER } from "@spine/shared/mobile";

export const SERVER_UNREACHABLE_MESSAGE = "Can't reach that server. Check the address — it's the link you open Spine with on a computer.";
export const SERVER_OFFLINE_MESSAGE = "You're offline. Connect to Wi-Fi or mobile data to sign in.";
export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";
export const SIGN_IN_FAILED_MESSAGE = "Couldn't sign in. Try again in a minute.";
export const TOO_MANY_ATTEMPTS_MESSAGE = "Too many sign-in attempts. Wait a minute, then try again.";
export const SERVER_REQUIRED_MESSAGE = "Enter your server address first — it's the link you open Spine with on a computer.";

/** Which field a sign-in error belongs under (US-MOB-01: errors sit under their field). */
export type SignInField = "server" | "email" | "password" | "form";

export class SignInError extends Error {
  constructor(
    readonly field: SignInField,
    message: string,
  ) {
    super(message);
    this.name = "SignInError";
  }
}

export interface ServerInfo {
  /** The address as the person typed it, normalised. */
  server: string;
  /** Where the API answered: `<server>/api` behind Caddy, or `<server>` in development. */
  apiBase: string;
  /** The web app, for "Forgot password?" (from `/health`'s `appUrl`, else the address). */
  appUrl: string;
}

export interface Member {
  name: string;
  email: string;
  role: "owner" | "staff" | "field" | string;
  organizationName: string;
  /** The business currency and locale, for money and dates (US-MOB-03); older servers leave them out. */
  currency?: string;
  locale?: string;
}

const HEALTH_TIMEOUT_MS = 8_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Bearer only (D-016): never send or store cookies. iOS's URL session keeps
    // Better Auth's session cookie otherwise, and a later sign-in carrying it
    // fails Better Auth's origin check for cookie requests.
    return await fetch(url, { ...init, credentials: "omit", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Finds the Spine API for a typed address, or throws a SignInError for the Server field. */
export async function discoverServer(address: string, online: OnlineCheck = isOnline): Promise<ServerInfo> {
  const server = normalizeServerAddress(address);
  if (!server) throw new SignInError("server", address.trim() ? SERVER_UNREACHABLE_MESSAGE : SERVER_REQUIRED_MESSAGE);
  for (const apiBase of apiBaseCandidates(server)) {
    try {
      const res = await fetchWithTimeout(`${apiBase}/health`, { headers: { Accept: "application/json" } }, HEALTH_TIMEOUT_MS);
      if (!res.ok) continue;
      const body = (await res.json()) as { status?: string; service?: string; appUrl?: string | null };
      if (body.status !== "ok" || (body.service !== undefined && body.service !== "spine")) continue;
      return { server, apiBase, appUrl: (body.appUrl ?? server).replace(/\/+$/, "") };
    } catch {
      // Not here (or not answering) — try the next candidate.
    }
  }
  throw new SignInError("server", (await online()) ? SERVER_UNREACHABLE_MESSAGE : SERVER_OFFLINE_MESSAGE);
}

/** Better Auth email sign-in; returns the bearer session token from `set-auth-token`. */
export async function passwordSignIn(apiBase: string, email: string, password: string): Promise<string> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      authUrl(apiBase, "sign-in/email"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", [CLIENT_VERSION_HEADER]: APP_VERSION },
        body: JSON.stringify({ email: email.trim(), password }),
      },
      15_000,
    );
  } catch {
    throw new SignInError("form", SIGN_IN_FAILED_MESSAGE);
  }
  if (res.status === 401 || res.status === 400) throw new SignInError("password", INVALID_CREDENTIALS_MESSAGE);
  if (res.status === 429) throw new SignInError("form", TOO_MANY_ATTEMPTS_MESSAGE);
  const token = res.headers.get("set-auth-token");
  if (!res.ok || !token) throw new SignInError("form", SIGN_IN_FAILED_MESSAGE);
  return token;
}

/** The caller's membership in their active organisation (`GET /org/members/me`). */
export function fetchMember(apiBase: string, token: string, online?: OnlineCheck): Promise<Member> {
  return apiRequest<Member>(apiBase, "GET", "/org/members/me", { token }, online);
}

/** Revokes the session on the server (US-MOB-02). Best effort: signing out works offline too. */
export async function revokeSession(apiBase: string, token: string): Promise<void> {
  try {
    await fetchWithTimeout(
      authUrl(apiBase, "sign-out"),
      { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: "{}" },
      8_000,
    );
  } catch {
    // The phone forgets the token either way; the server session expires on its own.
  }
}
