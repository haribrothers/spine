import { AppShellHeader } from "@spine/ui";
import { LeadsBoard } from "./leads-board";

/**
 * S-01.5 — the pipeline board (kanban by stage, total value per stage),
 * completing the story left as a flat per-contact list under Contacts
 * (see contacts/leads-section.tsx's own comment on that deferral). This is
 * the org-wide view: every lead across every contact, grouped into columns
 * by the fixed stage enum, each column showing a running value total.
 */
export default function LeadsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Sales" }, { label: "Pipeline" }]}
        title="Pipeline"
        description="Every open lead, grouped by stage."
      />
      <LeadsBoard />
    </>
  );
}
