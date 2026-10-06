import { AppShellHeader } from "@spine/ui";
import { PrintHeader, PrintRangeProvider } from "../../../components/print-header";
import { PayablesExplorer } from "./payables-explorer";

/** PRD FEAT-07 (S-07.7) — outstanding vendor bills bucketed by how overdue they are, the AP-side mirror of receivables/page.tsx. */
export default function PayablesPage() {
  return (
    <PrintRangeProvider>
      <AppShellHeader
        breadcrumb={[{ label: "Purchases" }, { label: "Payables" }]}
        title="Payables"
        description="Outstanding vendor bill balances, bucketed by how overdue they are."
      />
      <PrintHeader />
      <PayablesExplorer />
    </PrintRangeProvider>
  );
}
