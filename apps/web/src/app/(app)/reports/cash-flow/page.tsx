import { ReportShell } from "../report-shell";
import { CashFlow } from "./cash-flow";

/** US-RPT-26 — Cash Flow. */
export default function CashFlowPage() {
  return (
    <ReportShell slug="cash-flow" description="Where cash came from and where it went">
      <CashFlow />
    </ReportShell>
  );
}
