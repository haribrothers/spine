"use client";

import { ChevronDown, Download } from "lucide-react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, printPage } from "@spine/ui";
import { periodLabel } from "@spine/shared";
import { usePrintRange } from "./print-header";
import { t, useT } from "../lib/i18n";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * US-RPT-32–US-RPT-34 (D-144) — `ReportExportMenu`: "Export" → CSV,
 * Excel (.xlsx), PDF or Print.
 * Each item is a plain link to the report's own API route with
 * `format=`, carrying the page's filters and search, so the file holds
 * exactly what's on screen; the session cookie goes with it and
 * `Content-Disposition` makes it a download.
 */
/** The range or date in a report path's query, as the printed header shows it. */
export function rangeFromPath(path: string): string | null {
  const params = new URLSearchParams(path.split("?")[1] ?? "");
  const from = params.get("from");
  const to = params.get("to");
  const asOf = params.get("asOf");
  if (from && to) return periodLabel(from, to);
  if (asOf) return t("reports.exportMenu.asOf", { date: periodLabel(asOf, asOf) });
  return null;
}

export function ReportExportMenu({ path, search, csvPath }: { path: string; search?: string; csvPath?: string }) {
  const t = useT();
  usePrintRange(rangeFromPath(path));
  const href = (base: string, format?: string) => {
    const params = new URLSearchParams();
    if (format) params.set("format", format);
    if (search?.trim()) params.set("search", search.trim());
    const query = params.toString();
    return `${API_URL}${base}${query ? `${base.includes("?") ? "&" : "?"}${query}` : ""}`;
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" data-testid="export-menu">
          <Download size={14} aria-hidden="true" />
          {t("reports.exportMenu.export")}
          <ChevronDown size={14} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={csvPath ? href(csvPath) : href(path, "csv")} data-testid="export-csv">
            {t("reports.exportMenu.csv")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={href(path, "xlsx")} data-testid="export-xlsx">
            {t("reports.exportMenu.excel")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={href(path, "pdf")} data-testid="export-pdf">
            {t("reports.exportMenu.pdf")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* US-RPT-34 — the browser's print dialog; the print stylesheet leaves the app chrome out. */}
        <DropdownMenuItem onSelect={() => window.setTimeout(printPage, 0)} data-testid="export-print">
          {t("reports.exportMenu.print")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
