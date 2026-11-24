"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { FileUp } from "lucide-react";
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
  FormField,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner, ScrollX } from "@spine/ui";
import {
  STATEMENT_DATE_FORMATS,
  STATEMENT_MAX_BYTES,
  STATEMENT_MAX_ROWS,
  STATEMENT_NOT_CSV,
  STATEMENT_TOO_BIG,
  guessStatementMapping,
  statementImportSummary,
  type StatementDateFormat,
  type StatementImportResult,
  type StatementMapping,
} from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useT } from "../../../lib/i18n";

const NONE = "__none__";

type Draft = {
  date: string;
  dateFormat: StatementDateFormat;
  description: string;
  reference: string;
  amountMode: "single" | "split";
  amount: string;
  moneyIn: string;
  moneyOut: string;
  balance: string;
};

const EMPTY: Draft = { date: "", dateFormat: "DD/MM/YYYY", description: "", reference: NONE, amountMode: "single", amount: "", moneyIn: "", moneyOut: "", balance: NONE };

function toDraft(m: Partial<StatementMapping>, headers: string[]): Draft {
  const has = (c: string | null | undefined) => (c && headers.includes(c) ? c : "");
  return {
    date: has(m.date),
    dateFormat: m.dateFormat ?? "DD/MM/YYYY",
    description: has(m.description),
    reference: has(m.reference) || NONE,
    amountMode: m.amountMode ?? "single",
    amount: has(m.amount),
    moneyIn: has(m.moneyIn),
    moneyOut: has(m.moneyOut),
    balance: has(m.balance) || NONE,
  };
}

/**
 * US-BANK-07 (D-157) — `StatementImportDialog`: choose a CSV, see its
 * first rows, map the columns (remembered per account), import. Lines
 * already imported are skipped; unreadable rows are listed with the reason.
 */
export function StatementImportDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
  onImported: (result: StatementImportResult) => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saved, setSaved] = useState<StatementMapping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<StatementImportResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setHeaders([]);
    setRows([]);
    setDraft(EMPTY);
    setError(null);
    setResult(null);
    apiClient
      .get<{ mapping: StatementMapping | null }>(`/money-accounts/${accountId}/statement-mapping`)
      .then((res) => setSaved(res.mapping))
      .catch(() => setSaved(null));
  }, [open, accountId]);

  function choose(next: File) {
    setError(null);
    setResult(null);
    if (!/\.csv$/i.test(next.name) && next.type !== "text/csv") {
      setError(STATEMENT_NOT_CSV);
      return;
    }
    if (next.size > STATEMENT_MAX_BYTES) {
      setError(STATEMENT_TOO_BIG);
      return;
    }
    Papa.parse<Record<string, string>>(next, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (parsed) => {
        const cols = parsed.meta.fields ?? [];
        if (!cols.length) {
          setError(STATEMENT_NOT_CSV);
          return;
        }
        if (parsed.data.length > STATEMENT_MAX_ROWS) {
          setError(STATEMENT_TOO_BIG);
          return;
        }
        setFile(next);
        setHeaders(cols);
        setRows(parsed.data);
        // The saved mapping first (US-BANK-07), filled in by a guess where the file's columns differ.
        const guess = toDraft(guessStatementMapping(cols, parsed.data.slice(0, 10)), cols);
        const fromSaved = saved ? toDraft(saved, cols) : null;
        setDraft(
          fromSaved
            ? {
                ...fromSaved,
                date: fromSaved.date || guess.date,
                description: fromSaved.description || guess.description,
                amount: fromSaved.amount || guess.amount,
                moneyIn: fromSaved.moneyIn || guess.moneyIn,
                moneyOut: fromSaved.moneyOut || guess.moneyOut,
              }
            : guess,
        );
      },
      error: () => setError(STATEMENT_NOT_CSV),
    });
  }

  const mapping: StatementMapping | null = useMemo(() => {
    if (!draft.date || !draft.description) return null;
    if (draft.amountMode === "single" ? !draft.amount : !(draft.moneyIn && draft.moneyOut)) return null;
    return {
      date: draft.date,
      dateFormat: draft.dateFormat,
      description: draft.description,
      reference: draft.reference === NONE ? null : draft.reference,
      amountMode: draft.amountMode,
      amount: draft.amountMode === "single" ? draft.amount : null,
      moneyIn: draft.amountMode === "split" ? draft.moneyIn : null,
      moneyOut: draft.amountMode === "split" ? draft.moneyOut : null,
      balance: draft.balance === NONE ? null : draft.balance,
    };
  }, [draft]);

  const previewColumns = mapping
    ? [mapping.date, mapping.description, mapping.reference, ...(mapping.amountMode === "single" ? [mapping.amount] : [mapping.moneyOut, mapping.moneyIn]), mapping.balance].filter((c): c is string => Boolean(c))
    : headers.slice(0, 6);

  async function handleImport() {
    if (!file || !mapping) return;
    setImporting(true);
    setError(null);
    try {
      const res = await apiClient.upload<StatementImportResult>(`/money-accounts/${accountId}/statement-imports`, file, { mapping: JSON.stringify(mapping) });
      setResult(res);
      onImported(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("banking.import.error"));
    } finally {
      setImporting(false);
    }
  }

  const columnSelect = (label: string, key: keyof Draft, optional = false) => (
    <FormField label={label} required={!optional} helperText={optional && key === "balance" ? t("banking.import.optional") : undefined}>
      {(field) => (
        <Select value={(draft[key] as string) || undefined} onValueChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}>
          <SelectTrigger id={field.id} aria-describedby={field["aria-describedby"]}>
            <SelectValue placeholder={t("banking.import.chooseColumn")} />
          </SelectTrigger>
          <SelectContent>
            {optional && <SelectItem value={NONE}>{t("banking.import.none")}</SelectItem>}
            {headers.map((h) => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );

  const dateSelect = columnSelect(t("banking.import.date"), "date");
  const descriptionSelect = columnSelect(t("banking.import.descriptionColumn"), "description");
  const referenceSelect = columnSelect(t("banking.import.reference"), "reference", true);
  const amountSelect = columnSelect(t("banking.import.amount"), "amount");
  const moneyOutSelect = columnSelect(t("banking.import.moneyOut"), "moneyOut");
  const moneyInSelect = columnSelect(t("banking.import.moneyIn"), "moneyIn");
  const balanceSelect = columnSelect(t("banking.import.balance"), "balance", true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t("banking.import.title", { name: accountName })}</DialogTitle>
          <DialogDescription>{t("banking.import.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {result ? (
            <div className="flex flex-col gap-3" data-testid="statement-import-result">
              <Alert variant={result.failed.length ? "warning" : "success"}>
                <AlertDescription>{statementImportSummary(result)}</AlertDescription>
              </Alert>
              {result.failed.length > 0 && (
                <ul className="flex flex-col gap-1 text-[13px] text-on-surface" aria-label={t("banking.import.failedRows")}>
                  {result.failed.map((f) => (
                    <li key={f.row}>
                      {t("banking.import.failedRow", { row: f.row, reason: f.reason })}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border-strong p-4">
                <div className="flex items-center gap-3">
                  <FileUp size={20} className="text-on-surface-muted" aria-hidden />
                  {file ? (
                    <div>
                      <p className="text-[14px] font-semibold text-on-surface">{file.name}</p>
                      <p className="text-[12px] text-on-surface-muted">
                        {t("banking.import.fileSummary", { rows: rows.length, kb: Math.max(1, Math.round(file.size / 1024)) })}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-on-surface-muted">{t("banking.import.fileHint")}</p>
                  )}
                </div>
                <Button variant={file ? "ghost" : "secondary"} className={file ? "text-primary" : undefined} onClick={() => inputRef.current?.click()}>
                  {file ? t("banking.import.chooseAnother") : t("banking.import.chooseFile")}
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  aria-label={t("banking.import.fileLabel")}
                  data-testid="statement-file"
                  onChange={(e) => {
                    const next = e.target.files?.[0];
                    if (next) choose(next);
                    e.target.value = "";
                  }}
                />
              </div>

              {file && (
                <>
                  <RadioGroup value={draft.amountMode} onValueChange={(v) => setDraft((d) => ({ ...d, amountMode: v as Draft["amountMode"] }))} className="flex flex-wrap gap-x-6 gap-y-2" aria-label={t("banking.import.amountColumns")}>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="single" id="amount-single" />
                      <Label htmlFor="amount-single">{t("banking.import.singleAmount")}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="split" id="amount-split" />
                      <Label htmlFor="amount-split">{t("banking.import.splitAmount")}</Label>
                    </div>
                  </RadioGroup>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {dateSelect}
                    <FormField label={t("banking.import.dateFormat")} required>
                      {(field) => (
                        <Select value={draft.dateFormat} onValueChange={(v) => setDraft((d) => ({ ...d, dateFormat: v as StatementDateFormat }))}>
                          <SelectTrigger id={field.id}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATEMENT_DATE_FORMATS.map((f) => (
                              <SelectItem key={f} value={f}>
                                {f}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </FormField>
                    {descriptionSelect}
                    {referenceSelect}
                    {draft.amountMode === "single" ? (
                      amountSelect
                    ) : (
                      <>
                        {moneyOutSelect}
                        {moneyInSelect}
                      </>
                    )}
                    {balanceSelect}
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-[14px] font-semibold text-on-surface">{t("banking.import.firstRows")}</h3>
                    <ScrollX label={t("ui.scrollX.label")} className="rounded-md border border-border">
                      <table className="w-full text-[13px]" data-testid="statement-preview">
                        <thead>
                          <tr className="border-b border-border bg-surface-sunken text-left text-on-surface-muted">
                            {previewColumns.map((c) => (
                              <th key={c} className="px-3 py-2 font-medium">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.slice(0, 10).map((r, i) => (
                            <tr key={i} className="border-b border-border last:border-0">
                              {previewColumns.map((c) => (
                                <td key={c} className="px-3 py-2 text-on-surface">
                                  {r[c] ?? ""}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollX>
                  </div>
                </>
              )}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>{t("banking.import.done")}</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={importing}>
                {t("banking.import.cancel")}
              </Button>
              <Button onClick={handleImport} disabled={!file || !mapping || importing}>
                {importing ? <Spinner size="sm" /> : t("banking.import.importLines", { n: rows.length })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
