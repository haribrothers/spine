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
  CSV_FORMULA_CELL,
  MAX_CATALOG_IMPORT_ROWS,
  restoreCsvFormula,
  type CatalogImportField,
  type CatalogImportResult,
  type CatalogImportRow,
} from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useT } from "../../../lib/i18n";

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
  const t = useT();
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
      transform: restoreCsvFormula,
      complete: (parsed) => {
        const cols = parsed.meta.fields ?? [];
        if (!cols.length) {
          setError(t("catalog.import.noColumns"));
          return;
        }
        if (parsed.data.length > MAX_CATALOG_IMPORT_ROWS) {
          setError(t("catalog.import.tooManyRows", { max: MAX_CATALOG_IMPORT_ROWS }));
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
      error: () => setError(t("catalog.import.unreadable")),
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
      setError(err instanceof Error ? err.message : t("catalog.import.failed"));
    } finally {
      setBusy(false);
    }
  }

  function downloadFailed() {
    if (!result) return;
    const failed = result.rows.filter((r) => r.status === "failed");
    const byRow = new Map(failed.map((r) => [r.row, r.reason]));
    const out = data.map((d, i) => ({ row: i + 2, d })).filter(({ row }) => byRow.has(row)).map(({ row, d }) => ({ ...d, Problem: byRow.get(row) ?? "" }));
    const csv = Papa.unparse(out.length ? out : [{ ...Object.fromEntries(headers.map((h) => [h, ""])), Problem: "" }], { escapeFormulae: CSV_FORMULA_CELL });
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
          <DialogTitle>{t("catalog.import.title")}</DialogTitle>
          <DialogDescription>{t("catalog.import.description")}</DialogDescription>
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
              <span className="text-[14px] font-medium text-on-surface">{t("catalog.import.chooseFile")}</span>
              <span className="text-[13px] text-on-surface-muted">{t("catalog.import.chooseHint")}</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                aria-label={t("catalog.import.chooseFile")}
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
                {t("catalog.import.mapIntro", { fileName, count: data.length })}
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {CATALOG_IMPORT_FIELDS.map((f) => (
                  <div key={f} className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-on-surface" id={`map-${f}`}>
                      {CATALOG_IMPORT_FIELD_LABELS[f]}
                      {f === "name" ? t("catalog.import.required") : ""}
                    </span>
                    <Select value={mapping[f] ?? NONE} onValueChange={(v) => setMapping((m) => ({ ...m, [f]: v === NONE ? undefined : v }))}>
                      <SelectTrigger aria-labelledby={`map-${f}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("catalog.import.notInFile")}</SelectItem>
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
              <p className="text-[13px] text-on-surface-muted">{t("catalog.import.mapHint")}</p>
            </>
          )}

          {step === "preview" && result && counts && (
            <>
              <p className="text-[14px] text-on-surface" data-testid="import-preview-summary">
                {t("catalog.import.previewSummary", { ok: counts.ok, duplicates: t("catalog.import.duplicates", { count: counts.duplicates }), failed: t("catalog.import.rows", { count: counts.failed }) })}
              </p>
              <div className="max-h-80 overflow-auto rounded-lg border border-border">
                <table className="w-full text-[13px]" data-testid="import-preview">
                  <thead>
                    <tr className="border-b border-border text-left text-on-surface-muted">
                      <th className="px-3 py-2 font-medium">{t("catalog.import.columnRow")}</th>
                      <th className="px-3 py-2 font-medium">{t("catalog.common.name")}</th>
                      <th className="px-3 py-2 font-medium">{t("catalog.import.columnResult")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 20).map((r) => (
                      <tr key={r.row} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 tabular-nums text-on-surface-muted">{r.row}</td>
                        <td className="px-3 py-2 text-on-surface">{r.name || "—"}</td>
                        <td className="px-3 py-2">
                          {r.status === "ok" ? (
                            <StatusChip status="paid">{t("catalog.import.ready")}</StatusChip>
                          ) : r.status === "duplicate" ? (
                            <StatusChip status="draft">{t("catalog.import.duplicateSkipped")}</StatusChip>
                          ) : (
                            <StatusChip status="overdue">{r.reason}</StatusChip>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.rows.length > 20 && <p className="text-[13px] text-on-surface-muted">{t("catalog.import.showingFirst", { count: result.rows.length })}</p>}
              {counts.failed > 0 && <p className="text-[13px] text-on-surface-muted">{t("catalog.import.problemsNote")}</p>}
            </>
          )}

          {step === "done" && result && counts && (
            <Alert variant={counts.failed ? "warning" : "success"}>
              <AlertDescription data-testid="import-summary">{CATALOG_IMPORT_SUMMARY(result.imported, counts.duplicates, counts.failed)}</AlertDescription>
            </Alert>
          )}
          {step === "done" && result && counts && counts.duplicates > 0 && (
            <p className="text-[13px] text-on-surface-muted">
              {t("catalog.import.skippedDuplicates", { names: result.rows.filter((r) => r.status === "duplicate").map((r) => r.name).join(", ") })}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          {step === "map" && (
            <>
              <Button variant="secondary" onClick={reset} disabled={busy}>
                {t("catalog.import.chooseAnother")}
              </Button>
              <Button onClick={() => send(true)} disabled={busy || !mapping.name}>
                {busy ? <Spinner size="sm" /> : t("catalog.import.preview")}
              </Button>
            </>
          )}
          {step === "preview" && counts && (
            <>
              <Button variant="secondary" onClick={() => setStep("map")} disabled={busy}>
                {t("catalog.import.back")}
              </Button>
              <Button onClick={() => send(false)} disabled={busy || counts.ok === 0}>
                {busy ? <Spinner size="sm" /> : t("catalog.import.importItems", { count: counts.ok })}
              </Button>
            </>
          )}
          {step === "done" && counts && (
            <>
              {counts.failed > 0 && (
                <Button variant="secondary" onClick={downloadFailed}>
                  {t("catalog.import.downloadFailed")}
                </Button>
              )}
              <Button onClick={() => onOpenChange(false)}>{t("catalog.import.done")}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
