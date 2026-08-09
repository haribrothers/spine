import { redirect } from "next/navigation";
import { AppShellHeader } from "@spine/ui";
import { getMyMembership } from "../../../../../lib/get-my-membership";
import { TeamDetailView } from "./team-detail-view";

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await getMyMembership();
  if (membership?.role !== "owner") {
    redirect("/dashboard");
  }

  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Team" }, { label: "Teams", href: "/team/teams" }, { label: "Detail" }]}
        title="Team"
      />
      <TeamDetailView teamId={id} />
    </>
  );
}
