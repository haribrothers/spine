import { AppShellHeader } from "@spine/ui";
import { InvoicesExplorer } from "./invoices-explorer";

/** PRD F5 Invoices (Stage 1 API, this stage's web UI) — multi-line invoices with issue/void, S-05.1/S-05.2/S-05.3/S-05.8/S-05.9. Advances/credit notes/quote conversion are later stages — see CHANGELOG. */
export default function InvoicesPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Billing" }, { label: "Invoices" }]}
        title="Invoices"
        description="Build multi-line invoices, issue them to post to the ledger, and track balances due."
      />
      <InvoicesExplorer />
    </>
  );
}
