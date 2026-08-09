import { redirect } from "next/navigation";
import { AppShellHeader } from "@spine/ui";
import { getMyMembership } from "../../../../lib/get-my-membership";
import { TeamsExplorer } from "./teams-explorer";

export default async function TeamsListPage() {
  const membership = await getMyMembership();
  if (membership?.role !== "owner") {
    redirect("/dashboard");
  }

  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Team" }, { label: "Teams" }]}
        title="Teams"
        description="Group Staff members and configure what each group can do."
      />
      <TeamsExplorer />
    </>
  );
}
