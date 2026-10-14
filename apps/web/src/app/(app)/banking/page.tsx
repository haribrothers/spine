import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { BankingExplorer } from "./banking-explorer";

/** US-BANK-01, US-BANK-13 (D-139, D-231) — Banking: bank, cash and card accounts and their balances. */
export default function BankingPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Money" }, { label: "Banking" }]}
        title="Banking"
        description="Bank, cash and card accounts, what moved through them, and reconciliation."
      />
      {/* US-BANK-13: reads its view from the address. */}
      <Suspense>
        <BankingExplorer />
      </Suspense>
    </>
  );
}
