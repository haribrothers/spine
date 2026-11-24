import { redirect } from "next/navigation";
import { getMyMembership } from "../../../../lib/get-my-membership";
import { UsersExplorer } from "./users-explorer";

/**
 * PRD §9 S-10.18 — Users/Teams/Permissions moved out of the Settings dialog
 * into their own top-level, Owner-only routed area. The sidebar link is
 * already hidden for non-Owners (see (app)/layout.tsx), but that's a UI
 * nicety, not access control — this page independently re-checks Owner
 * status server-side and redirects a Staff/Field user who navigates here
 * directly, matching Spine's "server-side authorization on every
 * endpoint" rule applied to routing too. The header is the explorer's own
 * (US-TEAM-19): its "Invite people" opens a dialog there.
 */
export default async function UsersPage() {
  const membership = await getMyMembership();
  if (membership?.role !== "owner") {
    redirect("/dashboard");
  }

  return <UsersExplorer currentMemberId={membership.id} />;
}
