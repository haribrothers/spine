"use client";

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
import { STATEMENT_DATE_FORMATS, parseStatementAmount, parseStatementDate, type OpeningBill, type OpeningImportResult, type StatementDateFormat } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const NONE = "__none__";

/**
 * US-RPT-18 — opening vendor bills: each unpaid bill from the old system,
 * added one by one or from CSV (vendors matched by name). They're paid
 * with a vendor payment like any other bill.
 */
export function OpeningBillsTab({ currency, locked, onChanged }: { currency: string; locked: boolean; onChanged: () => void }) {
  const [rows, setRows] = useState<OpeningBill[] | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<OpeningBill | "new" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVendors = useCallback(() => {
    apiClient
      .get<{ id: string; name: string; type: string }[]>("/contacts")
      .then((list) => setVendors(list.filter((c) => c.type !== "customer")))
      .catch(() => {});
  }, []);
  const load = useCallback(() => {
    apiClient.get<OpeningBill[]>("/opening-balances/bills").then(setRows).catch(() => setRows([]));
  }, []);

  useEffect(() => {
    load();
    loadVendors();
  }, [load, loadVendors]);

  const changed = () => {
    load();
    onChanged();
  };

  async function remove(row: OpeningBill) {
    setError(null);
    try {
      await apiClient.delete(`/opening-balances/bills/${row.id}`);
      changed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove this bill.");
    }
  }

  const money = (v: string | bigint) => formatMoney(BigInt(v), currency);
  const total = (rows ?? []).reduce((s, r) => s + BigInt(r.amountDue), 0n);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard label="Opening bills" value={rows ? String(rows.length) : "—"} />
        <StatCard label="Amount due" value={money(total)} />
      </div>
      {!locked && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            Import from CSV
          </Button>
          <Button onClick={() => setEditing("new")}>Add bill</Button>
        </div>
      )}
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-[14px]" data-testid="opening-bills">
          <thead>
            <tr className="border-b border-border text-left text-on-surface-muted">
              <th className="px-4 py-3 font-medium">Bill number</th>
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">Bill date</th>
              <th className="px-4 py-3 font-medium">Due date</th>
              <th className="px-4 py-3 text-right font-medium">Amount due</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[13px] text-on-surface-muted">
                  No opening bills yet.
                </td>
              </tr>
            )}
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-on-surface">{r.billNumber}</td>
                <td className="px-4 py-3 text-on-surface">{r.contactName}</td>
                <td className="px-4 py-3 text-on-surface">{day(r.billDate)}</td>
                <td className="px-4 py-3 text-on-surface">{r.dueDate ? day(r.dueDate) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.amountDue)}</td>
                <td className="px-4 py-3 text-right">
                  {!locked && !r.hasActivity ? (
                    <span className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" aria-label={`Edit bill ${r.billNumber}`} onClick={() => setEditing(r)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`Remove bill ${r.billNumber}`} onClick={async () => {
                      if (await confirm({ title: `Remove opening bill ${r.billNumber}?`, description: "Its entry is reversed in your books and it comes out of your opening balances. You can add it again.", confirmLabel: "Remove", danger: true })) void remove(r);
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
      <p className="text-[13px] text-on-surface-muted">Opening bills keep the vendor&apos;s numbers, have no lines or tax, and show on Payables to be paid like any other bill. Attach the original to each one.</p>

      <OpeningBillDialog value={editing} onClose={() => setEditing(null)} vendors={vendors} currency={currency} onSaved={() => { setEditing(null); changed(); }} />
      <OpeningBillImport open={importOpen} onOpenChange={setImportOpen} currency={currency} onImported={() => { changed(); loadVendors(); }} />
      {confirmDialog}
    </div>
  );
}

function OpeningBillDialog({ value, onClose, vendors, currency, onSaved }: { value: OpeningBill | "new" | null; onClose: () => void; vendors: { id: string; name: string }[]; currency: string; onSaved: () => void }) {
  const existing = value && value !== "new" ? value : null;
  const [contactId, setContactId] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState<Date | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [amount, setAmount] = useState(0n);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    setContactId(existing?.contactId ?? "");
    setBillNumber(existing?.billNumber ?? "");
    setBillDate(existing ? new Date(`${existing.billDate}T00:00:00`) : undefined);
    setDueDate(existing?.dueDate ? new Date(`${existing.dueDate}T00:00:00`) : undefined);
    setAmount(existing ? BigInt(existing.amountDue) : 0n);
    setError(null);
  }, [value, existing]);

  async function save() {
    if (!contactId || !billNumber.trim() || !billDate || !dueDate) {
      setError("Enter the vendor, bill number and both dates.");
      return;
    }
    setSaving(true);
    setError(null);
    const body = { contactId, billNumber: billNumber.trim(), billDate: iso(billDate), dueDate: iso(dueDate), amountDue: amount.toString() };
    try {
      if (existing) await apiClient.put(`/opening-balances/bills/${existing.id}`, body);
      else await apiClient.post("/opening-balances/bills", body);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this bill.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={value !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit opening bill ${existing.billNumber}` : "Add opening bill"}</DialogTitle>
          <DialogDescription>An unpaid bill from your old system, as it stood on the cutover date.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Vendor" required>
              {(field) => (
                <Select value={contactId || undefined} onValueChange={setContactId}>
                  <SelectTrigger id={field.id}>
                    <SelectValue placeholder="Choose a vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField label="Bill number" required>
              {(field) => <Input {...field} value={billNumber} onChange={(e) => setBillNumber(e.target.value)} maxLength={60} placeholder="The vendor's number" />}
            </FormField>
            <FormField label="Bill date" required>
              {() => <DatePicker value={billDate} onChange={setBillDate} />}
            </FormField>
            <FormField label="Due date" required>
              {() => <DatePicker value={dueDate} onChange={setDueDate} />}
            </FormField>
            <FormField label="Amount due" required>
              {(field) => <MoneyInput id={field.id} value={amount} onValueChange={setAmount} currency={currency} />}
            </FormField>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner size="sm" /> : existing ? "Save bill" : "Add bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const FIELDS = [
  { key: "vendor", label: "Vendor name", required: true, guess: /vendor|supplier|name/i },
  { key: "number", label: "Bill number", required: true, guess: /number|no\.?$|bill|ref/i },
  { key: "billDate", label: "Bill date", required: true, guess: /bill date|^date$|issued/i },
  { key: "dueDate", label: "Due date", required: true, guess: /due/i },
  { key: "amountDue", label: "Amount due", required: true, guess: /amount|balance|outstanding/i },
] as const;
type FieldKey = (typeof FIELDS)[number]["key"];

function OpeningBillImport({ open, onOpenChange, currency, onImported }: { open: boolean; onOpenChange: (open: boolean) => void; currency: string; onImported: () => void }) {
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

  const ready = FIELDS.every((f) => mapping[f.key]);
  const rows = useMemo(
    () =>
      data.map((r, i) => {
        const cell = (k: FieldKey) => (mapping[k] ? (r[mapping[k]!] ?? "").trim() : "");
        const amount = parseStatementAmount(cell("amountDue"), currency);
        return {
          row: i + 2,
          vendor: cell("vendor"),
          number: cell("number"),
          billDate: parseStatementDate(cell("billDate"), dateFormat) ?? "",
          dueDate: parseStatementDate(cell("dueDate"), dateFormat) ?? "",
          amountDue: amount === null || amount < 0n ? "" : amount.toString(),
        };
      }),
    [data, mapping, dateFormat, currency],
  );

  async function run(createVendors: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post<OpeningImportResult>("/opening-balances/bills/import", { rows: rows.filter((r) => r.vendor), createVendors });
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
          <DialogTitle>Import opening bills from CSV</DialogTitle>
          <DialogDescription>One row per unpaid bill from your old system. Vendors are matched by name.</DialogDescription>
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
                  Imported {result.imported} bills · {result.failed.length} rows couldn&apos;t be imported
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
                {unmatched.length} vendor {unmatched.length === 1 ? "name didn't" : "names didn't"} match anyone in Spine: {unmatched.join(", ")}.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => run(true)} disabled={busy}>
                  {busy ? <Spinner size="sm" /> : "Create these vendors"}
                </Button>
                <Button variant="ghost" className="text-primary" onClick={() => onOpenChange(false)}>
                  Fix the file
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border-strong p-4">
                <p className="text-[13px] text-on-surface">{fileName ? `${fileName} · ${data.length} rows` : "A CSV with a row per unpaid bill."}</p>
                <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                  {fileName ? "Choose another file" : "Choose file"}
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  aria-label="Opening bills file"
                  data-testid="opening-bills-file"
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
                    <FormField key={f.key} label={f.label} required>
                      {(field) => (
                        <Select value={mapping[f.key] ?? NONE} onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === NONE ? undefined : v }))}>
                          <SelectTrigger id={field.id}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Choose a column</SelectItem>
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
                  {busy ? <Spinner size="sm" /> : `Import ${data.length} bills`}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
