"use client";

import { AppShellHeader, Spinner } from "@spine/ui";
import { FINANCIAL_STATEMENTS_NO_ACCESS, REPORTS, canOpenReport } from "@spine/shared";
import { useCapabilities } from "../../../lib/capabilities-context";
import { useMyRole } from "../../../lib/role-context";
import { NoAccess } from "../../../components/no-access";
import { PrintHeader, PrintRangeProvider } from "../../../components/print-header";

/** US-RPT-23 — one report's page: "Reports › <name>", and the no-access page for anyone who can't open it. */
export function ReportShell({ slug, description, children }: { slug: string; description?: string; children: React.ReactNode }) {
  const report = REPORTS.find((r) => r.slug === slug)!;
  const role = useMyRole();
  const { capabilities } = useCapabilities();
  if (role === null || capabilities === null) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }
  if (!canOpenReport(report, role, capabilities)) {
    // US-RPT-36 — the statements an accountant's Team can be given say so.
    const statements = report.access !== "owner" && report.access.includes("reports.view_financial_statements");
    return <NoAccess pageName={report.label} ownerOnly={report.access === "owner"} message={statements ? FINANCIAL_STATEMENTS_NO_ACCESS : undefined} />;
  }
  return (
    <PrintRangeProvider>
      <AppShellHeader breadcrumb={[{ label: "Reports", href: "/reports" }, { label: report.label }]} title={report.label} description={description} />
      <PrintHeader />
      {children}
    </PrintRangeProvider>
  );
}
