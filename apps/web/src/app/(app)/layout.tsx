import { AppLayout } from "../../components/app-layout";
import { getMyMembership } from "../../lib/get-my-membership";
import { getSession } from "../../lib/get-session";
import { NAV_SECTIONS, TEAM_NAV_SECTION } from "../../lib/nav-sections";

/**
 * Shared chrome for every authenticated page (dashboard, quotes, contacts,
 * catalog) — a Next.js layout, not a per-page wrapper, so the sidebar stays
 * mounted across navigations instead of remounting on every page load. That
 * matters because AppLayout's collapse state is read from localStorage in a
 * post-mount effect (`hydrated`): remounting it on every nav briefly forced
 * `collapsed` back to false, producing an expand/collapse flicker each time
 * — moving it here (mounted once by Next.js, not once per page.tsx) fixes
 * that at the root instead of patching around it. Session is fetched once
 * here rather than duplicated in every page.tsx.
 */
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const [session, membership] = await Promise.all([getSession(), getMyMembership()]);
  const sections = membership?.role === "owner" ? [...NAV_SECTIONS, TEAM_NAV_SECTION] : NAV_SECTIONS;

  return (
    <AppLayout sections={sections} userName={session?.user?.name ?? "Signed in"} userEmail={session?.user?.email ?? ""}>
      {children}
    </AppLayout>
  );
}
