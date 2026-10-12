import { Suspense } from "react";
import { PrintRangeProvider } from "../../../components/print-header";
import { PayablesExplorer } from "./payables-explorer";

/**
 * PRD FEAT-07 (S-07.7) and US-PUR-56 to US-PUR-60 (D-230) — what we owe
 * vendors and for how long, vendor by vendor or bill by bill; the AP-side
 * mirror of receivables/page.tsx. The header lives in the explorer, which
 * knows the day it's as of.
 */
export default function PayablesPage() {
  return (
    <PrintRangeProvider>
      {/* US-DASH-21, US-PUR-60: reads its view from the address. */}
      <Suspense>
        <PayablesExplorer />
      </Suspense>
    </PrintRangeProvider>
  );
}
