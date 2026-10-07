"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { AppShellHeader, Spinner } from "@spine/ui";
import { FINANCIAL_STATEMENTS_NO_ACCESS, REPORTS, canOpenReport } from "@spine/shared";
import { useCapabilities } from "../../../lib/capabilities-context";
import { useMyRole } from "../../../lib/role-context";
import { NoAccess } from "../../../components/no-access";
import { PrintHeader, PrintRangeProvider, useCurrentPrintRange } from "../../../components/print-header";

const DetailContext = createContext<((detail: string | null) => void) | null>(null);

/**
 * US-RPT-40 — what the report on screen adds after its range in the page
 * description, e.g. "compared with Jan 1 – Sep 30, 2025 · Cash basis".
 */
export function useReportDetail(detail: string | null) {
  const set = useContext(DetailContext);
  useEffect(() => {
    set?.(detail);
    return () => set?.(null);
  }, [detail, set]);
}

/** "Income less expenses for a period · Jan 1 – Oct 6, 2026 · Cash basis": the description, the range the filters cover and any detail. */
function ReportHeader({ label, href, description, detail, page }: { label: string; href: string; description?: string; detail: string | null; page?: string }) {
  const range = useCurrentPrintRange();
  const text = [description, range, detail].filter(Boolean).join(" · ");
  // A report's own sub-page (US-RPT-39: "Reports › Export to Tally › Account mapping").
  const breadcrumb = page ? [{ label: "Reports", href: "/reports" }, { label, href }, { label: page }] : [{ label: "Reports", href: "/reports" }, { label }];
  return <AppShellHeader breadcrumb={breadcrumb} title={page ?? label} description={text || undefined} />;
}

/** US-RPT-23 — one report's page: "Reports › <name>", and the no-access page for anyone who can't open it. */
export function ReportShell({ slug, description, page, children }: { slug: string; description?: string; page?: { label: string; parentHref: string }; children: React.ReactNode }) {
  const report = REPORTS.find((r) => r.slug === slug)!;
  const role = useMyRole();
  const { capabilities } = useCapabilities();
  const [detail, setDetail] = useState<string | null>(null);
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
      <DetailContext.Provider value={setDetail}>
        <ReportHeader label={report.label} href={page?.parentHref ?? report.href} description={description} detail={detail} page={page?.label} />
        <PrintHeader />
        <div className="flex flex-col gap-6">{children}</div>
      </DetailContext.Provider>
    </PrintRangeProvider>
  );
}
