import { redirect } from "next/navigation";
import { AppShellHeader } from "@spine/ui";
import { getMyMembership } from "../../../../lib/get-my-membership";
import { UsersExplorer } from "./users-explorer";

/**
 * PRD §9 S-10.18 — Users/Teams/Permissions moved out of the Settings dialog
 * into their own top-level, Owner-only routed area. The sidebar link is
 * already hidden for non-Owners (see (app)/layout.tsx), but that's a UI
 * nicety, not access control — this page independently re-checks Owner
 * status server-side and redirects a Staff/Field user who navigates here
 * directly, matching CLAUDE.md's "server-side authorization on every
 * endpoint" rule applied to routing too.
 */
export default async function UsersPage() {
  const membership = await getMyMembership();
  if (membership?.role !== "owner") {
    redirect("/dashboard");
  }

  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Team" }, { label: "Users" }]}
        title="Users"
        description="Everyone with access to this organisation."
      />
      <UsersExplorer currentMemberId={membership.id} />
    </>
  );
}
