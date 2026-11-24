import { redirect } from "next/navigation";
import { getMyMembership } from "../../../../../lib/get-my-membership";
import { TeamPage } from "./team-page";

/** Owner-only, re-checked here as on every team/* page; the header is the Team page's own (US-TEAM-27). */
export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await getMyMembership();
  if (membership?.role !== "owner") {
    redirect("/dashboard");
  }

  return <TeamPage teamId={id} />;
}
