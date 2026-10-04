import { Download } from "lucide-react";
import { Button } from "@spine/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * "Export CSV" for a report (US-PAY-10, US-PUR-14). A plain link to the
 * API's `export.csv` route: the session cookie goes with it, and the
 * response's `Content-Disposition` makes it a download.
 */
export function ExportCsvButton({ path, search }: { path: string; search?: string }) {
  const query = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  return (
    <Button asChild variant="secondary" size="sm">
      <a href={`${API_URL}${path}${query}`} data-testid="export-csv">
        <Download size={14} aria-hidden="true" />
        Export CSV
      </a>
    </Button>
  );
}
