import { AppShellHeader } from "@spine/ui";
import { t } from "../../../lib/i18n";
import { ActivityExplorer } from "./activity-explorer";

/** US-DASH-19 — the whole activity feed, from the dashboard's "View all". */
export default function ActivityPage() {
  return (
    <>
      <AppShellHeader breadcrumb={[{ label: t("activity.page.breadcrumbOverview") }, { label: t("activity.page.title") }]} title={t("activity.page.title")} description={t("activity.page.description")} />
      <ActivityExplorer />
    </>
  );
}
