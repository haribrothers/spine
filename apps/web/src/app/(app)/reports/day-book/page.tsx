import { ReportShell } from "../report-shell";
import { DayBook } from "./day-book";
import { t } from "../../../../lib/i18n";

/** US-RPT-25 — Day book. */
export default function DayBookPage() {
  return (
    <ReportShell slug="day-book" description={t("reports.pages.dayBook.description")}>
      <DayBook />
    </ReportShell>
  );
}
