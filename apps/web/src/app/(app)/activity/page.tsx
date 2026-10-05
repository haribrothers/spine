import { AppShellHeader } from "@spine/ui";
import { ActivityExplorer } from "./activity-explorer";

/** US-DASH-19 — the whole activity feed, from the dashboard's "View all". */
export default function ActivityPage() {
  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Overview" }, { label: "Activity" }]} title="Activity" description="What's happened recently, newest first." />
      <ActivityExplorer />
    </>
  );
}
