"use client";

import { useState } from "react";
import Papa from "papaparse";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  StatusChip,
} from "@spine/ui";
import { FileUp } from "lucide-react";
import {
  CATALOG_IMPORT_FIELD_LABELS,
  CATALOG_IMPORT_FIELDS,
  CATALOG_IMPORT_SUMMARY,
  MAX_CATALOG_IMPORT_ROWS,
  type CatalogImportField,
  type CatalogImportResult,
  type CatalogImportRow,
} from "@spine/shared";
import { apiClient } from "../../../lib/api-client";

/** How each field's column is guessed from the file's headings. */
const GUESS: Record<CatalogImportField, RegExp> = {
  name: /^(item\s*)?name$|^item$|^product|^service/i,
  description: /desc/i,
  unit: /^unit|uom/i,
  category: /^categor|^group$|^type$/i,
  price: /price|rate|amount|cost/i,
  tax: /tax|gst|vat/i,
  hsnSac: /hsn|sac/i,
  incomeAccount: /income|sales\s*acc|revenue/i,
  expenseAccount: /expense|purchase\s*acc|cogs/i,
};
const NONE = "__none__";

type Step = "choose" | "map" | "preview" | "done";

/**
 * US-CAT-09 (D-161) — `ImportCatalogDialog`: choose a CSV, map its columns
 * to Name, Description, Unit, Price, Tax, Income account and Expense
 * account, preview the first rows (unknown taxes and accounts, duplicates
 * and bad rows are flagged), then import. The summary reads "Imported <n>
 * items · skipped <m> duplicates · <k> rows failed" with the failed rows
 * to download.
 */
export function ImportCatalogDialog({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (open: boolean) => void; onImported: () => void }) {
  const [step, setStep] = useState<Step>("choose");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<CatalogImportField, string>>>({});
  const [result, setResult] = useState<CatalogImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("choose");
    setFileName("");
    setHeaders([]);
    setData([]);
    setMapping({});
    setResult(null);
    setError(null);
  }

  function choose(file: File) {
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (parsed) => {
        const cols = parsed.meta.fields ?? [];
        if (!cols.length) {
          setError("That file has no columns. Save it from your spreadsheet as CSV.");
          return;
        }
        if (parsed.data.length > MAX_CATALOG_IMPORT_ROWS) {
          setError(`Import ${MAX_CATALOG_IMPORT_ROWS} rows or fewer at a time — split the file.`);
          return;
        }
        setFileName(file.name);
        setHeaders(cols);
        setData(parsed.data);
        const guess: Partial<Record<CatalogImportField, string>> = {};
        for (const f of CATALOG_IMPORT_FIELDS) {
          const found = cols.find((c) => GUESS[f].test(c) && !Object.values(guess).includes(c));
          if (found) guess[f] = found;
        }
        setMapping(guess);
        setStep("map");
      },
      error: () => setError("That file couldn't be read. Save it from your spreadsheet as CSV."),
    });
  }

  /** Header row is line 1, so the first data row is line 2. */
  const rows = (): CatalogImportRow[] =>
    data.map((d, i) => {
      const row: CatalogImportRow = { row: i + 2 };
      for (const f of CATALOG_IMPORT_FIELDS) {
        const col = mapping[f];
        if (col) row[f] = (d[col] ?? "").trim();
      }
      return row;
    });

  async function send(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post<CatalogImportResult>("/catalog-items/import", { rows: rows(), dryRun });
      setResult(res);
      setStep(dryRun ? "preview" : "done");
      if (!dryRun) onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The import didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function downloadFailed() {
    if (!result) return;
    const failed = result.rows.filter((r) => r.status === "failed");
    const byRow = new Map(failed.map((r) => [r.row, r.reason]));
    const out = data.map((d, i) => ({ row: i + 2, d })).filter(({ row }) => byRow.has(row)).map(({ row, d }) => ({ ...d, Problem: byRow.get(row) ?? "" }));
    const csv = Papa.unparse(out.length ? out : [{ ...Object.fromEntries(headers.map((h) => [h, ""])), Problem: "" }]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/\.csv$/i, "") || "catalogue"}-failed-rows.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const counts = result
    ? {
        ok: result.rows.filter((r) => r.status === "ok").length,
        duplicates: result.rows.filter((r) => r.status === "duplicate").length,
        failed: result.rows.filter((r) => r.status === "failed").length,
      }
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import catalogue items</DialogTitle>
          <DialogDescription>From a CSV saved from your spreadsheet or old system. Items already in the catalogue are skipped, never changed.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === "choose" && (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong px-6 py-10 text-center hover:bg-surface-sunken focus-within:ring-2 focus-within:ring-primary">
              <FileUp className="size-6 text-on-surface-muted" aria-hidden />
              <span className="text-[14px] font-medium text-on-surface">Choose a CSV file</span>
              <span className="text-[13px] text-on-surface-muted">One item per row, with a heading row.</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                aria-label="Choose a CSV file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) choose(file);
                }}
              />
            </label>
          )}

          {step === "map" && (
            <>
              <p className="text-[14px] text-on-surface">
                {fileName} · {data.length} {data.length === 1 ? "row" : "rows"}. Match each field to a column; only Name is required.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CATALOG_IMPORT_FIELDS.map((f) => (
                  <div key={f} className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-on-surface" id={`map-${f}`}>
                      {CATALOG_IMPORT_FIELD_LABELS[f]}
                      {f === "name" ? " (required)" : ""}
                    </span>
                    <Select value={mapping[f] ?? NONE} onValueChange={(v) => setMapping((m) => ({ ...m, [f]: v === NONE ? undefined : v }))}>
                      <SelectTrigger aria-labelledby={`map-${f}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not in the file</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <p className="text-[13px] text-on-surface-muted">Tax is matched to a tax rate or group by name; accounts by code or name. Unit defaults to &quot;each&quot;.</p>
            </>
          )}

          {step === "preview" && result && counts && (
            <>
              <p className="text-[14px] text-on-surface" data-testid="import-preview-summary">
                {counts.ok} ready to import · {counts.duplicates} {counts.duplicates === 1 ? "duplicate" : "duplicates"} to skip · {counts.failed} {counts.failed === 1 ? "row" : "rows"} with problems
              </p>
              <div className="max-h-80 overflow-auto rounded-lg border border-border">
                <table className="w-full text-[13px]" data-testid="import-preview">
                  <thead>
                    <tr className="border-b border-border text-left text-on-surface-muted">
                      <th className="px-3 py-2 font-medium">Row</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 20).map((r) => (
                      <tr key={r.row} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 tabular-nums text-on-surface-muted">{r.row}</td>
                        <td className="px-3 py-2 text-on-surface">{r.name || "—"}</td>
                        <td className="px-3 py-2">
                          {r.status === "ok" ? (
                            <StatusChip status="paid">Ready</StatusChip>
                          ) : r.status === "duplicate" ? (
                            <StatusChip status="draft">Duplicate — skipped</StatusChip>
                          ) : (
                            <StatusChip status="overdue">{r.reason}</StatusChip>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.rows.length > 20 && <p className="text-[13px] text-on-surface-muted">Showing the first 20 of {result.rows.length} rows.</p>}
              {counts.failed > 0 && <p className="text-[13px] text-on-surface-muted">Rows with problems are skipped. Fix them in the file and import it again, or go ahead without them.</p>}
            </>
          )}

          {step === "done" && result && counts && (
            <Alert variant={counts.failed ? "warning" : "success"}>
              <AlertDescription data-testid="import-summary">{CATALOG_IMPORT_SUMMARY(result.imported, counts.duplicates, counts.failed)}</AlertDescription>
            </Alert>
          )}
          {step === "done" && result && counts && counts.duplicates > 0 && (
            <p className="text-[13px] text-on-surface-muted">
              Skipped as duplicates: {result.rows.filter((r) => r.status === "duplicate").map((r) => r.name).join(", ")}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          {step === "map" && (
            <>
              <Button variant="secondary" onClick={reset} disabled={busy}>
                Choose another file
              </Button>
              <Button onClick={() => send(true)} disabled={busy || !mapping.name}>
                {busy ? <Spinner size="sm" /> : "Preview"}
              </Button>
            </>
          )}
          {step === "preview" && counts && (
            <>
              <Button variant="secondary" onClick={() => setStep("map")} disabled={busy}>
                Back
              </Button>
              <Button onClick={() => send(false)} disabled={busy || counts.ok === 0}>
                {busy ? <Spinner size="sm" /> : `Import ${counts.ok} ${counts.ok === 1 ? "item" : "items"}`}
              </Button>
            </>
          )}
          {step === "done" && counts && (
            <>
              {counts.failed > 0 && (
                <Button variant="secondary" onClick={downloadFailed}>
                  Download failed rows
                </Button>
              )}
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
