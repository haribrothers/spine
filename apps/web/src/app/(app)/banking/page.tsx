import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { t } from "../../../lib/i18n";
import { BankingExplorer } from "./banking-explorer";

/** US-BANK-01, US-BANK-13 (D-139, D-231) — Banking: bank, cash and card accounts and their balances. */
export default function BankingPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("banking.page.breadcrumbMoney") }, { label: t("banking.page.title") }]}
        title={t("banking.page.title")}
        description={t("banking.page.description")}
      />
      {/* US-BANK-13: reads its view from the address. */}
      <Suspense>
        <BankingExplorer />
      </Suspense>
    </>
  );
}
