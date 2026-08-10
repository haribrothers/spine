import { AppShellHeader } from "@spine/ui";
import { ReceivablesExplorer } from "./receivables-explorer";

/** PRD F9/F6 (S-06.7, S-09.5) — outstanding invoices bucketed by how overdue they are. */
export default function ReceivablesPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Billing" }, { label: "Receivables" }]}
        title="Receivables"
        description="Outstanding invoice balances, bucketed by how overdue they are."
      />
      <ReceivablesExplorer />
    </>
  );
}
