import { AppShellHeader } from "@spine/ui";
import { getMyMembership } from "../../../lib/get-my-membership";
import { NoAccess } from "../../../components/no-access";
import { SetupView } from "./setup-view";

/** US-ONB-15 (D-155) — Set up Spine: every setup step and whether it's done. Owner-only, like Settings. */
export default async function SetupPage() {
  const membership = await getMyMembership();
  if (membership?.role !== "owner") return <NoAccess pageName="Set up Spine" ownerOnly />;
  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Set up Spine" }]} title="Set up Spine" description="Everything a new business sets up, in one place. Owners only." />
      <SetupView />
    </>
  );
}
