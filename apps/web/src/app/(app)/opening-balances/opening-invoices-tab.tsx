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
import { STATEMENT_DATE_FORMATS, parseStatementAmount, parseStatementDate, type OpeningImportResult, type OpeningInvoice, type StatementDateFormat } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const NONE = "__none__";

type Option = { id: string; name: string };
type JobOption = { id: string; name: string; number: string | null };

/**
 * US-RPT-17 — opening customer invoices: each unpaid invoice from the old
 * system with its own number and dates, and any retention held on a job.
 * Added one by one or imported from CSV; customers are matched by name.
 */
export function OpeningInvoicesTab({ currency, locked, onChanged }: { currency: string; locked: boolean; onChanged: () => void }) {
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
      setError(err instanceof Error ? err.message : "Couldn't remove this invoice.");
    }
  }

  const money = (v: string | bigint) => formatMoney(BigInt(v), currency);
  const totalDue = (rows ?? []).reduce((s, r) => s + BigInt(r.amountDue), 0n);
  const totalRetention = (rows ?? []).reduce((s, r) => s + BigInt(r.retentionHeld), 0n);
  const retentionJobs = new Set((rows ?? []).filter((r) => BigInt(r.retentionHeld) > 0n).map((r) => r.job?.id)).size;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Opening invoices" value={rows ? String(rows.length) : "—"} />
        <StatCard label="Amount due" value={money(totalDue)} />
        <StatCard label="Retention held" value={money(totalRetention)} trend={{ direction: "neutral", label: `on ${retentionJobs} ${retentionJobs === 1 ? "job" : "jobs"}` }} />
        <StatCard label="Customers not matched" value={String(unmatchedCount)} trend={{ direction: "neutral", label: "from the last import" }} />
      </div>
      {!locked && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            Import from CSV
          </Button>
          <Button onClick={() => setEditing("new")}>Add invoice</Button>
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
              <th className="px-4 py-3 font-medium">Invoice number</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Invoice date</th>
              <th className="px-4 py-3 font-medium">Due date</th>
              <th className="px-4 py-3 text-right font-medium">Amount due</th>
              <th className="px-4 py-3 text-right font-medium">Retention held</th>
              <th className="px-4 py-3 font-medium">Job</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-[13px] text-on-surface-muted">
                  No opening invoices yet.
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
                      <Button variant="ghost" size="sm" aria-label={`Edit ${r.number}`} onClick={() => setEditing(r)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`Remove ${r.number}`} onClick={async () => {
                      if (await confirm({ title: `Remove opening invoice ${r.number}?`, description: "Its entry is reversed in your books and it comes out of your opening balances. You can add it again.", confirmLabel: "Remove", danger: true })) void remove(r);
                    }}>
                        Remove
                      </Button>
                    </span>
                  ) : r.hasActivity ? (
                    <span className="text-[12px] text-on-surface-muted">Paid or credited</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-on-surface-muted">Opening invoices keep your old numbers, have no lines or tax, and age, get paid and get reminded like any other invoice. Attach the original PDF to each one.</p>

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
      setError("Enter the customer, invoice number and both dates.");
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
      setError(err instanceof Error ? err.message : "Couldn't save this invoice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={value !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit opening invoice ${existing.number}` : "Add opening invoice"}</DialogTitle>
          <DialogDescription>An unpaid invoice from your old system, as it stood on the cutover date.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Customer" required>
              {(field) => (
                <Select value={contactId || undefined} onValueChange={setContactId}>
                  <SelectTrigger id={field.id}>
                    <SelectValue placeholder="Choose a customer" />
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
            <FormField label="Invoice number" required>
              {(field) => <Input {...field} value={number} onChange={(e) => setNumber(e.target.value)} maxLength={60} placeholder="As on your old invoice" />}
            </FormField>
            <FormField label="Invoice date" required>
              {() => <DatePicker value={invoiceDate} onChange={setInvoiceDate} />}
            </FormField>
            <FormField label="Due date" required>
              {() => <DatePicker value={dueDate} onChange={setDueDate} />}
            </FormField>
            <FormField label="Amount due" required>
              {(field) => <MoneyInput id={field.id} value={amountDue} onValueChange={setAmountDue} currency={currency} />}
            </FormField>
            <FormField label="Retention held" helperText="Optional — held back on a job until the job is done.">
              {(field) => <MoneyInput id={field.id} aria-describedby={field["aria-describedby"]} value={retention} onValueChange={setRetention} currency={currency} />}
            </FormField>
            {/* US-SET-24: no jobs while Jobs & field is switched off. */}
            {jobsOn && (
              <FormField label="Job" helperText={retention > 0n ? "Needed for retention." : "Optional."}>
                {(field) => (
                  <Select value={jobId} onValueChange={setJobId}>
                    <SelectTrigger id={field.id} aria-describedby={field["aria-describedby"]}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No job</SelectItem>
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
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner size="sm" /> : existing ? "Save invoice" : "Add invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const FIELDS = [
  { key: "customer", label: "Customer name", required: true, guess: /customer|client|name/i },
  { key: "number", label: "Invoice number", required: true, guess: /number|no\.?$|invoice/i },
  { key: "invoiceDate", label: "Invoice date", required: true, guess: /invoice date|^date$|issued/i },
  { key: "dueDate", label: "Due date", required: true, guess: /due/i },
  { key: "amountDue", label: "Amount due", required: true, guess: /amount|due amount|balance|outstanding/i },
  { key: "retentionHeld", label: "Retention held", required: false, guess: /retention/i },
  { key: "job", label: "Job", required: false, guess: /job/i },
] as const;
type FieldKey = (typeof FIELDS)[number]["key"];

/** US-RPT-17 — "Import from CSV": map the columns, check each row, match customers by name. */
function OpeningInvoiceImport({ open, onOpenChange, currency, onImported, onUnmatched }: { open: boolean; onOpenChange: (open: boolean) => void; currency: string; onImported: () => void; onUnmatched: (n: number) => void }) {
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
      complete: (parsed) => {
        const cols = parsed.meta.fields ?? [];
        if (!cols.length) {
          setError("That file has no columns. Export it from your old system as CSV.");
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
      error: () => setError("That file couldn't be read. Export it from your old system as CSV."),
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
      setError(err instanceof Error ? err.message : "Couldn't import this file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import opening invoices from CSV</DialogTitle>
          <DialogDescription>One row per unpaid invoice from your old system. Customers are matched by name.</DialogDescription>
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
                  Imported {result.imported} invoices · {result.failed.length} rows couldn&apos;t be imported
                </AlertDescription>
              </Alert>
              <ul className="flex flex-col gap-1 text-[13px] text-on-surface">
                {result.failed.map((f) => (
                  <li key={f.row}>
                    Row {f.row}: {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : unmatched ? (
            <Card className="flex flex-col gap-3" data-testid="opening-import-unmatched">
              <h3 className="text-[15px] font-semibold text-on-surface">Import from CSV · {fileName}</h3>
              <p className="text-[14px] text-on-surface">
                {unmatched.length} customer {unmatched.length === 1 ? "name didn't" : "names didn't"} match anyone in Spine: {unmatched.join(", ")}.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => run(true)} disabled={busy}>
                  {busy ? <Spinner size="sm" /> : "Create these customers"}
                </Button>
                <Button variant="ghost" className="text-primary" onClick={() => onOpenChange(false)}>
                  Fix the file
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border-strong p-4">
                <p className="text-[13px] text-on-surface">{fileName ? `${fileName} · ${data.length} rows` : "A CSV with a row per unpaid invoice."}</p>
                <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                  {fileName ? "Choose another file" : "Choose file"}
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  aria-label="Opening invoices file"
                  data-testid="opening-invoices-file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) choose(f);
                    e.target.value = "";
                  }}
                />
              </div>
              {fileName && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {FIELDS.map((f) => (
                    <FormField key={f.key} label={f.label} required={f.required}>
                      {(field) => (
                        <Select value={mapping[f.key] ?? NONE} onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === NONE ? undefined : v }))}>
                          <SelectTrigger id={field.id}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{f.required ? "Choose a column" : "None"}</SelectItem>
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
                  <FormField label="Date format" required>
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
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              {!unmatched && (
                <Button onClick={() => run(false)} disabled={!fileName || !ready || busy}>
                  {busy ? <Spinner size="sm" /> : `Import ${data.length} invoices`}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
