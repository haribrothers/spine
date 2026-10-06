import { ReportShell } from "../report-shell";
import { DayBook } from "./day-book";

/** US-RPT-25 — Day book. */
export default function DayBookPage() {
  return (
    <ReportShell slug="day-book" description="Every journal entry in date order">
      <DayBook />
    </ReportShell>
  );
}
