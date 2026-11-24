import { cookies } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

export interface SpineSession {
  user: {
    id: string;
    name: string;
    email: string;
  };
  session: {
    id: string;
    activeOrganizationId?: string | null;
  };
}

/**
 * Server-side session read for Server Components/middleware/layouts.
 *
 * apps/web has no local Better Auth instance to call `auth.api.getSession()`
 * against — the instance lives in apps/api, a different app/package. The
 * correct pattern for a separate API server (per PRD §6.2) is to
 * forward the incoming request's Cookie header to the API's own session
 * endpoint and read back the session JSON, rather than importing server
 * code across an app boundary.
 */
export async function getSession(): Promise<SpineSession | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) {
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as SpineSession | null;
    return data ?? null;
  } catch {
    // API unreachable — treat as unauthenticated rather than throwing, so a
    // down API degrades to "logged out" instead of crashing every page.
    return null;
  }
}
