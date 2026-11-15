"use client";

import { useModule } from "../../../lib/modules-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  DatePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  MoneyInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  StatCard,
  useConfirm,
} from "@spine/ui";
import { STATEMENT_DATE_FORMATS, restoreCsvFormula, parseStatementAmount, parseStatementDate, type OpeningImportResult, type OpeningInvoice, type StatementDateFormat } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { t, useT } from "../../../lib/i18n";
import { formatMoney, orgLocaleTag } from "../../../lib/money";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(orgLocaleTag(), { month: "short", day: "numeric", year: "numeric" });
const NONE = "__none__";

type Option = { id: string; name: string };
type JobOption = { id: string; name: string; number: string | null };

/**
 * US-RPT-17 — opening customer invoices: each unpaid invoice from the old
 * system with its own number and dates, and any retention held on a job.
 * Added one by one or imported from CSV; customers are matched by name.
 */
export function OpeningInvoicesTab({ currency, locked, onChanged }: { currency: string; locked: boolean; onChanged: () => void }) {
  const t = useT();
  const [rows, setRows] = useState<OpeningInvoice[] | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [customers, setCustomers] = useState<Option[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [editing, setEditing] = useState<OpeningInvoice | "new" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiClient.get<OpeningInvoice[]>("/opening-balances/invoices").then(setRows).catch(() => setRows([]));
  }, []);

  useEffect(() => {
    load();
    apiClient
      .get<{ id: string; name: string; type: string }[]>("/contacts")
      .then((list) => setCustomers(list.filter((c) => c.type !== "vendor").map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
    apiClient.get<JobOption[]>("/jobs").then(setJobs).catch(() => {});
  }, [load]);

  const changed = () => {
    load();
    onChanged();
  };

  async function remove(row: OpeningInvoice) {
    setError(null);
    try {
      await apiClient.delete(`/opening-balances/invoices/${row.id}`);
      changed();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("openingBalances.invoices.removeError"));
    }
  }

  const money = (v: string | bigint) => formatMoney(BigInt(v), currency);
  const totalDue = (rows ?? []).reduce((s, r) => s + BigInt(r.amountDue), 0n);
  const totalRetention = (rows ?? []).reduce((s, r) => s + BigInt(r.retentionHeld), 0n);
  const retentionJobs = new Set((rows ?? []).filter((r) => BigInt(r.retentionHeld) > 0n).map((r) => r.job?.id)).size;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("openingBalances.invoices.openingInvoices")} value={rows ? String(rows.length) : "—"} />
        <StatCard label={t("openingBalances.common.amountDue")} value={money(totalDue)} />
        <StatCard label={t("openingBalances.common.retentionHeld")} value={money(totalRetention)} trend={{ direction: "neutral", label: t("openingBalances.invoices.onJobs", { count: retentionJobs }) }} />
        <StatCard label={t("openingBalances.invoices.notMatched")} value={String(unmatchedCount)} trend={{ direction: "neutral", label: t("openingBalances.invoices.fromLastImport") }} />
      </div>
      {!locked && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            {t("openingBalances.invoices.importCsv")}
          </Button>
          <Button onClick={() => setEditing("new")}>{t("openingBalances.invoices.add")}</Button>
        </div>
      )}
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-[14px]" data-testid="opening-invoices">
          <thead>
            <tr className="border-b border-border text-left text-on-surface-muted">
              <th className="px-4 py-3 font-medium">{t("openingBalances.invoices.colNumber")}</th>
              <th className="px-4 py-3 font-medium">{t("openingBalances.invoices.colCustomer")}</th>
              <th className="px-4 py-3 font-medium">{t("openingBalances.common.invoiceDate")}</th>
              <th className="px-4 py-3 font-medium">{t("openingBalances.common.dueDate")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("openingBalances.common.amountDue")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("openingBalances.common.retentionHeld")}</th>
              <th className="px-4 py-3 font-medium">{t("openingBalances.common.job")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("openingBalances.common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-[13px] text-on-surface-muted">
                  {t("openingBalances.invoices.empty")}
                </td>
              </tr>
            )}
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-on-surface">{r.number}</td>
                <td className="px-4 py-3 text-on-surface">{r.contactName}</td>
                <td className="px-4 py-3 text-on-surface">{day(r.invoiceDate)}</td>
                <td className="px-4 py-3 text-on-surface">{day(r.dueDate)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.amountDue)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{BigInt(r.retentionHeld) > 0n ? money(r.retentionHeld) : "—"}</td>
                <td className="px-4 py-3 text-on-surface">{r.job ? `${r.job.number ? `${r.job.number} · ` : ""}${r.job.name}` : "—"}</td>
                <td className="px-4 py-3 text-right">
                  {!locked && !r.hasActivity ? (
                    <span className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" aria-label={t("openingBalances.invoices.editAria", { number: r.number })} onClick={() => setEditing(r)}>
                        {t("openingBalances.common.edit")}
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={t("openingBalances.invoices.removeAria", { number: r.number })} onClick={async () => {
                      if (await confirm({ title: t("openingBalances.invoices.removeTitle", { number: r.number }), description: t("openingBalances.common.removeBody"), confirmLabel: t("openingBalances.common.remove"), danger: true })) void remove(r);
                    }}>
                        {t("openingBalances.common.remove")}
                      </Button>
                    </span>
                  ) : r.hasActivity ? (
                    <span className="text-[12px] text-on-surface-muted">{t("openingBalances.common.paidOrCredited")}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-on-surface-muted">{t("openingBalances.invoices.footnote")}</p>

      <OpeningInvoiceDialog
        value={editing}
        onClose={() => setEditing(null)}
        customers={customers}
        jobs={jobs}
        currency={currency}
        onSaved={() => {
          setEditing(null);
          changed();
        }}
      />
      <OpeningInvoiceImport
        open={importOpen}
        onOpenChange={setImportOpen}
        currency={currency}
        onUnmatched={setUnmatchedCount}
        onImported={() => {
          changed();
          apiClient
            .get<{ id: string; name: string; type: string }[]>("/contacts")
            .then((list) => setCustomers(list.filter((c) => c.type !== "vendor").map((c) => ({ id: c.id, name: c.name }))))
            .catch(() => {});
        }}
      />
      {confirmDialog}
    </div>
  );
}

function OpeningInvoiceDialog({
  value,
  onClose,
  customers,
  jobs,
  currency,
  onSaved,
}: {
  value: OpeningInvoice | "new" | null;
  onClose: () => void;
  customers: Option[];
  jobs: JobOption[];
  currency: string;
  onSaved: () => void;
}) {
  const t = useT();
  const existing = value && value !== "new" ? value : null;
  const jobsOn = useModule("jobsField");
  const [contactId, setContactId] = useState("");
  const [number, setNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState<Date | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [amountDue, setAmountDue] = useState(0n);
  const [retention, setRetention] = useState(0n);
  const [jobId, setJobId] = useState(NONE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    setContactId(existing?.contactId ?? "");
    setNumber(existing?.number ?? "");
    setInvoiceDate(existing ? new Date(`${existing.invoiceDate}T00:00:00`) : undefined);
    setDueDate(existing ? new Date(`${existing.dueDate}T00:00:00`) : undefined);
    setAmountDue(existing ? BigInt(existing.amountDue) : 0n);
    setRetention(existing ? BigInt(existing.retentionHeld) : 0n);
    setJobId(existing?.job?.id ?? NONE);
    setError(null);
  }, [value, existing]);

  async function save() {
    if (!contactId || !number.trim() || !invoiceDate || !dueDate) {
      setError(t("openingBalances.invoices.missingFields"));
      return;
    }
    setSaving(true);
    setError(null);
    const body = { contactId, number: number.trim(), invoiceDate: iso(invoiceDate), dueDate: iso(dueDate), amountDue: amountDue.toString(), retentionHeld: retention.toString(), jobId: jobId === NONE ? null : jobId };
    try {
      if (existing) await apiClient.put(`/opening-balances/invoices/${existing.id}`, body);
      else await apiClient.post("/opening-balances/invoices", body);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("openingBalances.invoices.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={value !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{existing ? t("openingBalances.invoices.editTitle", { number: existing.number }) : t("openingBalances.invoices.addTitle")}</DialogTitle>
          <DialogDescription>{t("openingBalances.invoices.dialogBody")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label={t("openingBalances.invoices.customer")} required>
              {(field) => (
                <Select value={contactId || undefined} onValueChange={setContactId}>
                  <SelectTrigger id={field.id}>
                    <SelectValue placeholder={t("openingBalances.invoices.chooseCustomer")} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField label={t("openingBalances.invoices.colNumber")} required>
              {(field) => <Input {...field} value={number} onChange={(e) => setNumber(e.target.value)} maxLength={60} placeholder={t("openingBalances.invoices.numberPlaceholder")} />}
            </FormField>
            <FormField label={t("openingBalances.common.invoiceDate")} required>
              {() => <DatePicker value={invoiceDate} onChange={setInvoiceDate} />}
            </FormField>
            <FormField label={t("openingBalances.common.dueDate")} required>
              {() => <DatePicker value={dueDate} onChange={setDueDate} />}
            </FormField>
            <FormField label={t("openingBalances.common.amountDue")} required>
              {(field) => <MoneyInput id={field.id} value={amountDue} onValueChange={setAmountDue} currency={currency} />}
            </FormField>
            <FormField label={t("openingBalances.common.retentionHeld")} helperText={t("openingBalances.invoices.retentionHelp")}>
              {(field) => <MoneyInput id={field.id} aria-describedby={field["aria-describedby"]} value={retention} onValueChange={setRetention} currency={currency} />}
            </FormField>
            {/* US-SET-24: no jobs while Jobs & field is switched off. */}
            {jobsOn && (
              <FormField label={t("openingBalances.common.job")} helperText={retention > 0n ? t("openingBalances.invoices.jobNeeded") : t("openingBalances.invoices.jobOptional")}>
                {(field) => (
                  <Select value={jobId} onValueChange={setJobId}>
                    <SelectTrigger id={field.id} aria-describedby={field["aria-describedby"]}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t("openingBalances.invoices.noJob")}</SelectItem>
                      {jobs.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.number ? `${j.number} · ` : ""}
                          {j.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("openingBalances.common.cancel")}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner size="sm" /> : existing ? t("openingBalances.invoices.save") : t("openingBalances.invoices.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const FIELDS = [
  { key: "customer", label: t("openingBalances.invoices.fieldCustomer"), required: true, guess: /customer|client|name/i },
  { key: "number", label: t("openingBalances.invoices.colNumber"), required: true, guess: /number|no\.?$|invoice/i },
  { key: "invoiceDate", label: t("openingBalances.common.invoiceDate"), required: true, guess: /invoice date|^date$|issued/i },
  { key: "dueDate", label: t("openingBalances.common.dueDate"), required: true, guess: /due/i },
  { key: "amountDue", label: t("openingBalances.common.amountDue"), required: true, guess: /amount|due amount|balance|outstanding/i },
  { key: "retentionHeld", label: t("openingBalances.common.retentionHeld"), required: false, guess: /retention/i },
  { key: "job", label: t("openingBalances.common.job"), required: false, guess: /job/i },
] as const;
type FieldKey = (typeof FIELDS)[number]["key"];

/** US-RPT-17 — "Import from CSV": map the columns, check each row, match customers by name. */
function OpeningInvoiceImport({ open, onOpenChange, currency, onImported, onUnmatched }: { open: boolean; onOpenChange: (open: boolean) => void; currency: string; onImported: () => void; onUnmatched: (n: number) => void }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, string>>>({});
  const [dateFormat, setDateFormat] = useState<StatementDateFormat>("DD/MM/YYYY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unmatched, setUnmatched] = useState<string[] | null>(null);
  const [result, setResult] = useState<OpeningImportResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setFileName(null);
    setHeaders([]);
    setData([]);
    setMapping({});
    setError(null);
    setUnmatched(null);
    setResult(null);
  }, [open]);

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
          setError(t("openingBalances.import.noColumns"));
          return;
        }
        setFileName(file.name);
        setHeaders(cols);
        setData(parsed.data);
        const guess: Partial<Record<FieldKey, string>> = {};
        for (const f of FIELDS) {
          const found = cols.find((c) => f.guess.test(c) && !Object.values(guess).includes(c));
          if (found) guess[f.key] = found;
        }
        setMapping(guess);
      },
      error: () => setError(t("openingBalances.import.unreadable")),
    });
  }

  const ready = FIELDS.every((f) => !f.required || mapping[f.key]);
  const rows = useMemo(
    () =>
      data.map((r, i) => {
        const cell = (k: FieldKey) => (mapping[k] ? (r[mapping[k]!] ?? "").trim() : "");
        const amount = parseStatementAmount(cell("amountDue"), currency);
        const retention = cell("retentionHeld") ? parseStatementAmount(cell("retentionHeld"), currency) : 0n;
        return {
          row: i + 2,
          customer: cell("customer"),
          number: cell("number"),
          invoiceDate: parseStatementDate(cell("invoiceDate"), dateFormat) ?? "",
          dueDate: parseStatementDate(cell("dueDate"), dateFormat) ?? "",
          amountDue: amount === null || amount < 0n ? "" : amount.toString(),
          retentionHeld: retention === null || retention < 0n ? "" : retention.toString(),
          job: cell("job") || null,
        };
      }),
    [data, mapping, dateFormat, currency],
  );

  async function run(createCustomers: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post<OpeningImportResult>("/opening-balances/invoices/import", { rows: rows.filter((r) => r.customer), createCustomers });
      onUnmatched(res.unmatched.length);
      if (res.unmatched.length) {
        setUnmatched(res.unmatched);
        return;
      }
      setUnmatched(null);
      setResult(res);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("openingBalances.import.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t("openingBalances.invoices.importTitle")}</DialogTitle>
          <DialogDescription>{t("openingBalances.invoices.importBody")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {result ? (
            <div className="flex flex-col gap-2" data-testid="opening-import-result">
              <Alert variant={result.failed.length ? "warning" : "success"}>
                <AlertDescription>
                  {t("openingBalances.invoices.importResult", { imported: result.imported, failed: result.failed.length })}
                </AlertDescription>
              </Alert>
              <ul className="flex flex-col gap-1 text-[13px] text-on-surface">
                {result.failed.map((f) => (
                  <li key={f.row}>
                    {t("openingBalances.import.failedRow", { row: f.row, reason: f.reason })}
                  </li>
                ))}
              </ul>
            </div>
          ) : unmatched ? (
            <Card className="flex flex-col gap-3" data-testid="opening-import-unmatched">
              <h3 className="text-[15px] font-semibold text-on-surface">{t("openingBalances.import.heading", { file: fileName ?? "" })}</h3>
              <p className="text-[14px] text-on-surface">
                {t("openingBalances.invoices.unmatched", { count: unmatched.length, names: unmatched.join(", ") })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => run(true)} disabled={busy}>
                  {busy ? <Spinner size="sm" /> : t("openingBalances.invoices.createCustomers")}
                </Button>
                <Button variant="ghost" className="text-primary" onClick={() => onOpenChange(false)}>
                  {t("openingBalances.import.fixFile")}
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border-strong p-4">
                <p className="text-[13px] text-on-surface">{fileName ? t("openingBalances.import.fileRows", { file: fileName, n: data.length }) : t("openingBalances.invoices.fileHint")}</p>
                <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                  {fileName ? t("openingBalances.import.chooseAnother") : t("openingBalances.import.chooseFile")}
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  aria-label={t("openingBalances.invoices.fileLabel")}
                  data-testid="opening-invoices-file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) choose(f);
                    e.target.value = "";
                  }}
                />
              </div>
              {fileName && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {FIELDS.map((f) => (
                    <FormField key={f.key} label={f.label} required={f.required}>
                      {(field) => (
                        <Select value={mapping[f.key] ?? NONE} onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === NONE ? undefined : v }))}>
                          <SelectTrigger id={field.id}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{f.required ? t("openingBalances.import.chooseColumn") : t("openingBalances.import.none")}</SelectItem>
                            {headers.map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </FormField>
                  ))}
                  <FormField label={t("openingBalances.import.dateFormat")} required>
                    {(field) => (
                      <Select value={dateFormat} onValueChange={(v) => setDateFormat(v as StatementDateFormat)}>
                        <SelectTrigger id={field.id}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATEMENT_DATE_FORMATS.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                </div>
              )}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>{t("openingBalances.import.done")}</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
                {t("openingBalances.common.cancel")}
              </Button>
              {!unmatched && (
                <Button onClick={() => run(false)} disabled={!fileName || !ready || busy}>
                  {busy ? <Spinner size="sm" /> : t("openingBalances.invoices.importN", { n: data.length })}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
