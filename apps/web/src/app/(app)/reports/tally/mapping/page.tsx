import { ReportShell } from "../../report-shell";
import { TallyMappingView } from "./tally-mapping-view";
import { t } from "../../../../../lib/i18n";

/** US-RPT-39 — the Tally group each account lands in. */
export default function TallyMappingPage() {
  return (
    <ReportShell slug="tally" description={t("reports.pages.tallyMapping.description")} page={{ label: t("reports.pages.tallyMapping.label"), parentHref: "/reports/tally" }}>
      <TallyMappingView />
    </ReportShell>
  );
}
