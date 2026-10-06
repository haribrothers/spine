import { AppShellHeader } from "@spine/ui";
import { BankingExplorer } from "./banking-explorer";

/** US-BANK-01 (D-139) — Banking: bank, cash and card accounts and their balances. */
export default function BankingPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Money" }, { label: "Banking" }]}
        title="Banking"
        description="Bank, cash and card accounts, what moved through them, and reconciliation."
      />
      <BankingExplorer />
    </>
  );
}
