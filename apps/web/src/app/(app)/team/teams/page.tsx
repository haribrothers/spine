import { redirect } from "next/navigation";
import { getMyMembership } from "../../../../lib/get-my-membership";
import { TeamsExplorer } from "./teams-explorer";

/** Owner-only, re-checked here as on every team/* page; the header is the explorer's own (US-TEAM-25). */
export default async function TeamsListPage() {
  const membership = await getMyMembership();
  if (membership?.role !== "owner") {
    redirect("/dashboard");
  }

  return <TeamsExplorer />;
}
