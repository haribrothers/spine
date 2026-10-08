"use client";

import { useEffect, useMemo, useState } from "react";
import { emailBodyText, type EmailDraft } from "@spine/shared";
import {
  Alert,
  AlertDescription,
  Button,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  RichTextEditor,
} from "@spine/ui";
import {
  NO_INVOICES_YET,
  STATEMENT_MODE_OPTIONS,
  STATEMENT_PERIOD_OPTIONS,
  statementPeriodRange,
  type Statement,
  type StatementMode,
  type StatementPeriod,
} from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import { filenameFrom, saveBlob } from "../../../lib/save-file";

/** A local calendar date as `YYYY-MM-DD`. */
function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDate(value: string): string {
  return new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * US-PAY-14 — "Send a statement" (`ContactStatementDialog`): the period and
 * what to show, a summary for the period, and who it goes to. "Download
 * PDF" saves the same PDF without emailing it.
 */
export function StatementDialog({
  open,
  onOpenChange,
  contactId,
  contactEmail,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactEmail: string | null;
  onSent: (email: string) => void;
}) {
  const [period, setPeriod] = useState<StatementPeriod>("last_90");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>(new Date());
  const [mode, setMode] = useState<StatementMode>("open");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  // US-SET-21: subject and message start from the Statement email template, refreshed with the period until edited.
  const [subject, setSubject] = useState("");
  const [edited, setEdited] = useState(false);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"send" | "download" | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setEmail(contactEmail ?? "");
    setEdited(false);
  }, [open, contactEmail]);

  const range = useMemo(() => {
    if (period !== "custom") return statementPeriodRange(period, toIsoDate(new Date()));
    if (!customFrom || !customTo) return null;
    return { from: toIsoDate(customFrom), to: toIsoDate(customTo) };
  }, [period, customFrom, customTo]);
  const query = range ? `from=${range.from}&to=${range.to}&mode=${mode}` : null;

  useEffect(() => {
    if (!open || !query || edited) return;
    let current = true;
    apiClient
      .get<EmailDraft>(`/contacts/${contactId}/statement/draft?${query}`)
      .then((d) => {
        if (!current) return;
        setSubject(d.subject);
        setMessage(d.message);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [open, contactId, query, edited]);

  useEffect(() => {
    if (!open || !query) return;
    let current = true;
    setStatement(null);
    apiClient
      .get<Statement>(`/contacts/${contactId}/statement?${query}`)
      .then((s) => current && setStatement(s))
      .catch((err) => current && setError(err instanceof Error ? err.message : "Couldn't work out the statement."));
    return () => {
      current = false;
    };
  }, [open, contactId, query]);

  async function download() {
    if (!query) return;
    setBusy("download");
    setError(null);
    try {
      const { blob, headers } = await apiClient.download(`/contacts/${contactId}/statement.pdf?${query}`);
      saveBlob(blob, filenameFrom(headers, "statement.pdf"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't download the statement.");
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!range) return;
    setBusy("send");
    setError(null);
    try {
      const result = await apiClient.post<{ sentTo: string }>(`/contacts/${contactId}/statement/send`, { ...range, mode, email: email.trim(), subject: subject.trim() || null, message: emailBodyText(message) ? message : null });
      onSent(result.sentTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the statement.");
    } finally {
      setBusy(null);
    }
  }

  const money = (amount: string) => (statement ? formatMoney(BigInt(amount), statement.currency) : "—");
  const noInvoices = statement !== null && !statement.hasInvoices;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Send a statement</DialogTitle>
          <DialogDescription>A statement lists every invoice, payment and credit for this customer in the period, with the balance due.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Period">
              {(field) => (
                <Select value={period} onValueChange={(v) => setPeriod(v as StatementPeriod)}>
                  <SelectTrigger {...field}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATEMENT_PERIOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField label="Show">
              {(field) => (
                <Select value={mode} onValueChange={(v) => setMode(v as StatementMode)}>
                  <SelectTrigger {...field}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATEMENT_MODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            {period === "custom" && (
              <>
                <FormField label="From">{() => <DatePicker value={customFrom} onChange={setCustomFrom} />}</FormField>
                <FormField label="To date">{() => <DatePicker value={customTo} onChange={setCustomTo} />}</FormField>
              </>
            )}
          </div>

          <dl aria-label="Statement summary" className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-sunken px-4 py-3 text-[14px]">
            {!statement ? (
              <div className="flex justify-center py-3">{range ? <Spinner size="sm" /> : <span className="text-on-surface-muted">Pick both dates.</span>}</div>
            ) : (
              <>
                <SummaryRow label={`Opening balance (${shortDate(statement.from)})`} value={money(statement.openingBalance)} />
                <SummaryRow label="Invoiced" value={money(statement.invoiced)} />
                <SummaryRow label="Paid and credited" value={money(statement.paidAndCredited)} />
                <SummaryRow label="Balance due" value={money(statement.balanceDue)} />
              </>
            )}
          </dl>

          <FormField label="To">{(field) => <Input {...field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />}</FormField>
          <FormField label="Subject">
            {(field) => (
              <Input
                {...field}
                maxLength={200}
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setEdited(true);
                }}
              />
            )}
          </FormField>
          <FormField label="Message" helperText="Starts from your template in Settings › Emails. Changes here apply to this email only.">
            {(field) => (
              <RichTextEditor
                id={field.id}
                aria-describedby={field["aria-describedby"]}
                aria-label="Message"
                value={message}
                onValueChange={(html) => {
                  setMessage(html);
                  setEdited(true);
                }}
              />
            )}
          </FormField>
          {noInvoices && <p className="text-[13px] text-on-surface-muted">{NO_INVOICES_YET}</p>}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={download} disabled={!statement || busy !== null}>
            {busy === "download" ? <Spinner size="sm" /> : "Download PDF"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy !== null}>
            Cancel
          </Button>
          <Button type="button" onClick={send} disabled={!statement || noInvoices || !email.trim() || busy !== null}>
            {busy === "send" ? <Spinner size="sm" /> : "Send statement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-on-surface-muted">{label}</dt>
      <dd className="font-semibold tabular-nums text-on-surface">{value}</dd>
    </div>
  );
}
