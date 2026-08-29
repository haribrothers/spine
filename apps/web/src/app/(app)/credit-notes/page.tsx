import { AppShellHeader } from "@spine/ui";
import { CreditNotesExplorer } from "./credit-notes-explorer";

/** PRD F5 S-05.6 — previously reachable only from an invoice's own detail page; a standalone list closes that gap. */
export default function CreditNotesPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Billing" }, { label: "Credit Notes" }]}
        title="Credit Notes"
        description="Every credit note issued across the org, correcting or refunding part of an invoice."
      />
      <CreditNotesExplorer />
    </>
  );
}
