import { cookies } from "next/headers";
import type { MemberRow } from "./members";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * Server-side "am I an Owner" check, mirroring get-session.ts's
 * cookie-forwarding pattern. Role is never on the session itself (Better
 * Auth resolves org role fresh per-request, not cached there — see
 * CapabilityGuard's own doc comment on the API side), so every place that
 * needs to gate on role — the sidebar's Team section (layout.tsx) and each
 * team/* page's own server-side check — calls this rather than trusting a
 * client-supplied role.
 */
export async function getMyMembership(): Promise<MemberRow | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) {
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/org/members/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as MemberRow;
  } catch {
    return null;
  }
}
