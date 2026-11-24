import { ReportShell } from "../report-shell";
import { Gstr1View } from "./gstr1-view";
import { t } from "../../../../lib/i18n";

/** US-TAX-16 — GSTR-1 for the GST portal. */
export default function Gstr1Page() {
  return (
    <ReportShell slug="gstr-1" description={t("reports.pages.gstr1.description")}>
      <Gstr1View />
    </ReportShell>
  );
}
