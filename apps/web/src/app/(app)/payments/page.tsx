import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { PaymentsExplorer } from "./payments-explorer";

/** US-PAY-21 (D-221) — every payment: what came in, the credit customers can still use, and what each payment paid. */
export default function PaymentsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Billing" }, { label: "Payments" }]}
        title="Payments"
        description="Money customers paid you — what it paid, and the credit they can still use."
      />
      {/* US-PAY-22: the explorer reads its state (and an old ?id= link) from the address. */}
      <Suspense>
        <PaymentsExplorer />
      </Suspense>
    </>
  );
}
