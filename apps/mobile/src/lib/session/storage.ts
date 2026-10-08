import * as SecureStore from "expo-secure-store";
import type { Member, ServerInfo } from "./sign-in";

/**
 * US-MOB-02 — the session lives in the keychain/keystore (expo-secure-store)
 * until the person signs out, so reopening the app days later lands on Today.
 * The last server and email stay after sign-out to prefill Sign in.
 */
export interface StoredSession extends ServerInfo {
  token: string;
  member: Member;
}

const SESSION_KEY = "spine.session";
const LAST_SIGN_IN_KEY = "spine.last-sign-in";

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed.token && parsed.apiBase ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  await SecureStore.setItemAsync(LAST_SIGN_IN_KEY, JSON.stringify({ server: session.server, email: session.member.email }));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function loadLastSignIn(): Promise<{ server: string; email: string } | null> {
  try {
    const raw = await SecureStore.getItemAsync(LAST_SIGN_IN_KEY);
    return raw ? (JSON.parse(raw) as { server: string; email: string }) : null;
  } catch {
    return null;
  }
}
