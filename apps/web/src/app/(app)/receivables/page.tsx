import { Suspense } from "react";
import { PrintRangeProvider } from "../../../components/print-header";
import { ReceivablesExplorer } from "./receivables-explorer";

/**
 * PRD F9/F6 (S-06.7, S-09.5) and US-PAY-27 to US-PAY-31 (D-224) — who owes
 * what and for how long, customer by customer or invoice by invoice. The
 * header lives in the explorer, which knows the day it's as of.
 */
export default function ReceivablesPage() {
  return (
    <PrintRangeProvider>
      {/* US-DASH-14, US-PAY-31: reads its view from the address. */}
      <Suspense>
        <ReceivablesExplorer />
      </Suspense>
    </PrintRangeProvider>
  );
}
