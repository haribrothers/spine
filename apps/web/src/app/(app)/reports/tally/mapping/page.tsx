import { ReportShell } from "../../report-shell";
import { TallyMappingView } from "./tally-mapping-view";

/** US-RPT-39 — the Tally group each account lands in. */
export default function TallyMappingPage() {
  return (
    <ReportShell slug="tally" description="Choose the Tally group each account lands in." page={{ label: "Account mapping", parentHref: "/reports/tally" }}>
      <TallyMappingView />
    </ReportShell>
  );
}
