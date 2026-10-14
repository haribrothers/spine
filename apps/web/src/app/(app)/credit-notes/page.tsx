import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { CreditNotesExplorer } from "./credit-notes-explorer";

/** US-INV-40 (D-219) — every credit note: what was credited, the credit customers still hold, and where each went. */
export default function CreditNotesPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Billing" }, { label: "Credit notes" }]}
        title="Credit notes"
        description="Corrections to issued invoices — what came off them, and the credit customers can use or be paid back."
      />
      {/* US-INV-41: the explorer reads its state from the address. */}
      <Suspense>
        <CreditNotesExplorer />
      </Suspense>
    </>
  );
}
