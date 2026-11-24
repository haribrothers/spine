import { AppShellHeader } from "@spine/ui";
import { getMyMembership } from "../../../lib/get-my-membership";
import { NoAccess } from "../../../components/no-access";
import { t } from "../../../lib/i18n";
import { SetupView } from "./setup-view";

/** US-ONB-15 (D-155) — Set up Spine: every setup step and whether it's done. Owner-only, like Settings. */
export default async function SetupPage() {
  const membership = await getMyMembership();
  if (membership?.role !== "owner") return <NoAccess pageName={t("setup.page.title")} ownerOnly />;
  return (
    <>
      <AppShellHeader breadcrumb={[{ label: t("setup.page.title") }]} title={t("setup.page.title")} description={t("setup.page.description")} />
      <SetupView />
    </>
  );
}
