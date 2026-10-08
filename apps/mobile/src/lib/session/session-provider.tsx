import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, type Method, type RequestOptions } from "../api/request";
import { AccessRemovedError, SessionExpiredError, UpdateRequiredError } from "../api/errors";
import { discoverServer, fetchMember, passwordSignIn, revokeSession, SignInError, SIGN_IN_FAILED_MESSAGE, type SignInField } from "./sign-in";
import { clearSession, loadLastSignIn, loadSession, saveSession, type StoredSession } from "./storage";
import { cache } from "../cache/cache-store";
import { outbox } from "../outbox/outbox";

export type SessionState =
  | { status: "loading" }
  | { status: "signedOut"; notice?: string; lastServer?: string; lastEmail?: string }
  | { status: "signedIn"; session: StoredSession };

export type SignInResult = { ok: true } | { ok: false; field: SignInField; message: string };

interface SessionContextValue {
  state: SessionState;
  /** True after any request answered 426 CLIENT_TOO_OLD (US-MOB-10). */
  updateRequired: boolean;
  signIn: (server: string, email: string, password: string) => Promise<SignInResult>;
  signOut: (notice?: string) => Promise<void>;
  /** The most recent signed-in session, kept after sign-out so screens that are unmounting can still render. */
  lastSession: StoredSession | null;
  /** Calls the API as the signed-in person; a removed or expired session signs out, 426 shows the update screen. */
  request: <T>(method: Method, path: string, options?: Omit<RequestOptions, "token">) => Promise<T>;
}

/** Exported for tests, which render screens with a fixed session. */
export const SessionContext = createContext<SessionContextValue | null>(null);
export type { SessionContextValue };

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}

/**
 * The signed-in session, for screens under a signed-in route. While signing
 * out, those screens can render once more before they unmount, so this falls
 * back to the last session rather than throwing.
 */
export function useSignedInSession(): StoredSession {
  const { state, lastSession } = useSession();
  const session = state.status === "signedIn" ? state.session : lastSession;
  if (!session) throw new Error("useSignedInSession needs a signed-in session");
  return session;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const [updateRequired, setUpdateRequired] = useState(false);
  const [lastSession, setLastSession] = useState<StoredSession | null>(null);
  const sessionRef = useRef<StoredSession | null>(null);

  /**
   * `discardOutbox`: signing out or losing access deletes what's waiting
   * (the warning said so, US-MOB-02); an expired session keeps it, to send
   * once the same person signs in again.
   */
  const endSession = useCallback(async (notice?: string, options: { discardOutbox?: boolean } = {}) => {
    const session = sessionRef.current;
    sessionRef.current = null;
    await clearSession();
    // The cached jobs, expenses and notifications are this person's: gone with the session.
    await cache.clear();
    if (options.discardOutbox) await outbox.clear();
    const last = await loadLastSignIn();
    setState({ status: "signedOut", notice, lastServer: last?.server ?? session?.server, lastEmail: last?.email ?? session?.member.email });
  }, []);

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof AccessRemovedError) void endSession(error.message, { discardOutbox: true });
      else if (error instanceof SessionExpiredError) void endSession(error.message);
      else if (error instanceof UpdateRequiredError) setUpdateRequired(true);
    },
    [endSession],
  );

  const request = useCallback(
    async <T,>(method: Method, path: string, options: Omit<RequestOptions, "token"> = {}): Promise<T> => {
      const session = sessionRef.current;
      if (!session) throw new SessionExpiredError();
      try {
        const result = await apiRequest<T>(session.apiBase, method, path, { ...options, token: session.token });
        setUpdateRequired(false);
        return result;
      } catch (error) {
        handleError(error);
        throw error;
      }
    },
    [handleError],
  );

  // Reopening the app: straight to Today with the saved session, then refresh
  // the profile quietly — a removed membership signs out with its notice.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await loadSession();
      if (cancelled) return;
      if (!saved) {
        const last = await loadLastSignIn();
        setState({ status: "signedOut", lastServer: last?.server, lastEmail: last?.email });
        return;
      }
      sessionRef.current = saved;
      setState({ status: "signedIn", session: saved });
      try {
        const member = await fetchMember(saved.apiBase, saved.token);
        if (cancelled || sessionRef.current?.token !== saved.token) return;
        const refreshed = { ...saved, member };
        sessionRef.current = refreshed;
        await saveSession(refreshed);
        setState({ status: "signedIn", session: refreshed });
      } catch (error) {
        handleError(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handleError]);

  const signIn = useCallback(async (server: string, email: string, password: string): Promise<SignInResult> => {
    try {
      const info = await discoverServer(server);
      const token = await passwordSignIn(info.apiBase, email, password);
      const member = await fetchMember(info.apiBase, token);
      const session: StoredSession = { ...info, token, member };
      sessionRef.current = session;
      await saveSession(session);
      setUpdateRequired(false);
      setState({ status: "signedIn", session });
      return { ok: true };
    } catch (error) {
      if (error instanceof SignInError) return { ok: false, field: error.field, message: error.message };
      if (error instanceof AccessRemovedError) return { ok: false, field: "form", message: error.message };
      if (error instanceof UpdateRequiredError) {
        setUpdateRequired(true);
        return { ok: false, field: "form", message: error.message };
      }
      return { ok: false, field: "form", message: SIGN_IN_FAILED_MESSAGE };
    }
  }, []);

  const signOut = useCallback(
    async (notice?: string) => {
      const session = sessionRef.current;
      if (session) await revokeSession(session.apiBase, session.token);
      await endSession(notice, { discardOutbox: true });
    },
    [endSession],
  );

  useEffect(() => {
    if (state.status === "signedIn") setLastSession(state.session);
  }, [state]);

  const value = useMemo(() => ({ state, updateRequired, lastSession, signIn, signOut, request }), [state, updateRequired, lastSession, signIn, signOut, request]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
