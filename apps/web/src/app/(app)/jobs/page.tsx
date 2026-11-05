import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { JobsExplorer } from "./jobs-explorer";
import { t } from "../../../lib/i18n";

/** PRD F4 (Phase 3 · Jobs & Construction Billing, Stage 4 web UI) — jobs created from an accepted quote or directly, with milestone billing, variation orders, retention, photos/notes, and job costing. See CHANGELOG for the API stages this consumes. */
export default function JobsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("jobs.page.title") }]}
        title={t("jobs.page.title")}
        description={t("jobs.page.description")}
      />
      {/* JobsExplorer keeps its state in the address (US-JOB-32) via useSearchParams, which needs a Suspense boundary. */}
      <Suspense>
        <JobsExplorer />
      </Suspense>
    </>
  );
}
