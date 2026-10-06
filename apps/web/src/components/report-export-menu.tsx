"use client";

import { ChevronDown, Download } from "lucide-react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@spine/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * US-RPT-32 (D-144) — `ReportExportMenu`: "Export" → CSV or Excel (.xlsx).
 * Each item is a plain link to the report's own API route with
 * `format=`, carrying the page's filters and search, so the file holds
 * exactly what's on screen; the session cookie goes with it and
 * `Content-Disposition` makes it a download.
 */
export function ReportExportMenu({ path, search, csvPath }: { path: string; search?: string; csvPath?: string }) {
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
        <Button variant="secondary" size="sm" data-testid="export-menu">
          <Download size={14} aria-hidden="true" />
          Export
          <ChevronDown size={14} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={csvPath ? href(csvPath) : href(path, "csv")} data-testid="export-csv">
            CSV
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={href(path, "xlsx")} data-testid="export-xlsx">
            Excel (.xlsx)
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
