import { getSession } from "../../../lib/get-session";
import { getMyMembership } from "../../../lib/get-my-membership";
import { DashboardShell } from "./dashboard-shell";

/**
 * Real landing page for the sign-up/login flow and for the onboarding
 * wizard's "finish"/"skip" actions. Middleware already redirects
 * unauthenticated requests to /login before this renders, but the session
 * is re-read here too so the page has real content to show rather than
 * trusting middleware alone. Deliberately does NOT redirect back into
 * /onboarding on every visit — onboarding is never a gate (an architecture rule), so a
 * returning user always lands here directly regardless of whether they
 * finished, skipped, or never started the wizard.
 *
 * Renders inside the shared AppShell provided by `(app)/layout.tsx` — same
 * shell Settings uses.
 *
 * Dashboard v2 Stage 3 (S-09.12): the actual role-adaptive composition now
 * lives in `DashboardShell` — this page only resolves `role` server-side
 * (via `getMyMembership()`, the same cookie-forwarding pattern the
 * sidebar's own Owner-only Team section already uses in `layout.tsx`) and
 * passes it down. Every widget still independently self-gates on its own
 * data endpoint's 403/error regardless of this role branch — see
 * `DashboardShell`'s own doc comment.
 */
export default async function DashboardPage() {
  const [session, membership] = await Promise.all([getSession(), getMyMembership()]);

  // US-DASH-12: the greeting and date line are written in the browser (its own time of day).
  return <DashboardShell role={membership?.role ?? null} userName={session?.user?.name ?? null} />;
}
