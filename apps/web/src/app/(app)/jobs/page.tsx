import { AppShellHeader } from "@spine/ui";
import { JobsExplorer } from "./jobs-explorer";

/** PRD F4 (Phase 3 · Jobs & Construction Billing, Stage 4 web UI) — jobs created from an accepted quote or directly, with milestone billing, variation orders, retention, photos/notes, and job costing. See CHANGELOG for the API stages this consumes. */
export default function JobsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Jobs" }]}
        title="Jobs"
        description="Track work from an accepted quote through milestone billing, variation orders, and retention."
      />
      <JobsExplorer />
    </>
  );
}
