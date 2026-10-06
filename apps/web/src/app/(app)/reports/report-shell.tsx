"use client";

import { AppShellHeader, Spinner } from "@spine/ui";
import { REPORTS, canOpenReport } from "@spine/shared";
import { useCapabilities } from "../../../lib/capabilities-context";
import { useMyRole } from "../../../lib/role-context";
import { NoAccess } from "../../../components/no-access";

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
  if (!canOpenReport(report, role, capabilities)) return <NoAccess pageName={report.label} ownerOnly={report.access === "owner"} />;
  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Reports", href: "/reports" }, { label: report.label }]} title={report.label} description={description} />
      {children}
    </>
  );
}
