"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Alert,
  AlertDescription,
  AppShellHeader,
  Button,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@spine/ui";
import { RECEIVABLES_AGES, RECEIVABLES_AGE_LABELS, type EmailOverride, type ReceivablesAge } from "@spine/shared";
import { Inbox, Info, RefreshCw, Search } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { replaceQuery } from "../../../lib/replace-query";
import { ReportExportMenu } from "../../../components/report-export-menu";
import { PrintHeader } from "../../../components/print-header";
import { AgingSummary } from "../../../components/aging-summary";
import { ActionError } from "../../../components/action-error";
import { useToast } from "../../../components/toast-host";
import { paymentRecordedToast, RecordPaymentDialog } from "../../../components/record-payment-dialog";
import { SendEmailDialog } from "../../../components/send-email-dialog";
import { ApplyCustomerCreditDialog } from "../invoices/apply-customer-credit-dialog";
import { StatementDialog } from "../contacts/statement-dialog";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { ReceivablesSkeleton } from "./receivables-skeleton";
import { ReceivablesTable } from "./receivables-table";
import { ReceivablesCustomersTable } from "./receivables-customers-table";
import { ReceivablesBulkBar } from "./receivables-bulk-bar";
import { customerView, filterInvoices, parseReceivablesState, receivablesQuery, type ReceivablesListState, type ReceivablesTab } from "./receivables-list-state";
import type { ReceivablesInvoiceRow, ReceivablesReport } from "./types";

import { SectionLink } from "../../../components/section-link";
const ALL_AGES = "__all__";

/** "Nothing 31–60 days late." — what an empty age says. */
function emptyAge(age: ReceivablesAge): string {
  if (age === "current") return "Nothing that isn't due yet.";
  if (age === "overdue") return "Nothing overdue.";
  return `Nothing ${RECEIVABLES_AGE_LABELS[age]} late.`;
}

type Dialog =
  | { kind: "record"; contactId?: string; contactName?: string | null; invoiceId?: string }
  | { kind: "credit"; row: ReceivablesInvoiceRow }
  | { kind: "remind"; row: ReceivablesInvoiceRow }
  | { kind: "statement"; contactId: string; email: string | null }
  | null;

/**
 * Receivables (US-PAY-09, US-PAY-27 to US-PAY-31, D-224): who owes what and
 * for how long, to chase from. The list layout every refined list shares —
 * tabs (By customer, By invoice), the cards and age bar (pressable, to filter
 * by age), the filter bar (age; Updated, Refresh, Export) and the search bar
 * — with tab, age, search, sort and page in the address (D-210). Rows act
 * through the existing dialogs; ticked invoices get Send reminders. The
 * aging adds up issued invoices' balances; retention held is a note.
 */
export function ReceivablesExplorer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canRemind = useCapability("invoices.send_reminder");
  const [state, setState] = useState<ReceivablesListState>(() => parseReceivablesState(new URLSearchParams(searchParams.toString())));
  const [report, setReport] = useState<ReceivablesReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const loading = useRef(false);
  const showToast = useToast();

  function update(patch: Partial<ReceivablesListState>) {
    const next = { ...state, page: 1, ...patch };
    setState(next);
    setSelected(new Set());
    replaceQuery(pathname, receivablesQuery(next));
  }

  const load = useCallback(async (mode: "first" | "refresh") => {
    if (loading.current) return;
    loading.current = true;
    if (mode === "refresh") setRefreshing(true);
    try {
      const next = await apiClient.get<ReceivablesReport>("/reports/receivables");
      setReport(next);
      // A paid invoice drops out of the selection.
      setSelected((current) => new Set([...current].filter((id) => next.invoices.some((i) => i.id === id))));
      setRefreshFailed(false);
      setUpdatedAt(Date.now());
      setNow(Date.now());
      if (mode === "refresh") setAnnouncement("Receivables updated");
    } catch (err) {
      if (mode === "first") setError(err instanceof Error ? err.message : "Could not load receivables.");
      else setRefreshFailed(true);
    } finally {
      loading.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("first");
  }, [load]);

  // Back on the tab after 30 s or more, refresh quietly (D-210).
  useEffect(() => {
    let hiddenAt: number | null = null;
    function onVisibility() {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt !== null && Date.now() - hiddenAt >= REFRESH_ON_RETURN_MS) void load("refresh");
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const today = useMemo(() => new Date(now), [now]);
  const invoices = useMemo(() => (report ? filterInvoices(report.invoices, state) : null), [report, state]);
  const customers = useMemo(() => (report ? customerView(report.customers, report.invoices, state) : null), [report, state]);
  const creditByContact = useMemo(() => new Map((report?.customers ?? []).map((c) => [c.contactId, BigInt(c.credit)])), [report]);
  const selectedRows = useMemo(() => (report ? report.invoices.filter((i) => selected.has(i.id)) : []), [report, selected]);

  /** After an action: what happened (D-223), and the list again. */
  function done(title: string, description: string) {
    setDialog(null);
    setActionError(null);
    showToast(title, description);
    void load("refresh");
  }

  async function sendReminder(row: ReceivablesInvoiceRow, email: EmailOverride) {
    try {
      await apiClient.post(`/invoices/${row.id}/send-reminder`, email);
      done("Reminder sent", row.contactName ? `A reminder for ${row.number} has been queued to ${row.contactName}.` : `A reminder for ${row.number} has been queued.`);
    } catch (err) {
      setActionError({ title: "Couldn't send the reminder.", message: err instanceof Error ? err.message : "Try again." });
      setDialog(null);
    }
  }

  const locale = orgLocaleTag();
  const asOf = report ? new Date(`${report.asOf}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : null;
  const header = (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Billing" }, { label: "Receivables" }]}
        title="Receivables"
        description={`What customers owe you, by how late it is${asOf ? ` · as of ${asOf}` : ""}`}
      />
      <PrintHeader />
    </>
  );

  if (error) {
    return (
      <>
        {header}
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </>
    );
  }

  const currency = report?.invoices[0]?.currency ?? "USD";
  const overdueCount = report ? report.invoices.filter((r) => r.bucket !== "current").length : 0;
  const ageQuery = state.age ? `?age=${encodeURIComponent(state.age)}` : "";
  const search = (
    <div className="relative w-96 max-w-full">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input
        type="search"
        placeholder={state.tab === "customer" ? "Search customers" : "Search invoices or customers"}
        aria-label="Search receivables"
        value={state.q}
        onChange={(e) => update({ q: e.target.value })}
        className="pl-9"
      />
    </div>
  );
  const retention = report && BigInt(report.retention.held) > 0n ? report.retention : null;
  const empty = (message: string, clear: () => void, label: string) => (
    <div className="flex flex-col gap-3">
      <div className="flex">{search}</div>
      <div className="rounded-lg border border-border bg-surface">
        <EmptyState icon={<Inbox />} title={message} description="Every other age is still on the cards and the bar above." action={<Button variant="secondary" onClick={clear}>{label}</Button>} />
      </div>
    </div>
  );

  const body = !report ? (
    <ReceivablesSkeleton />
  ) : (
    <div className="flex flex-col gap-6">
      <AgingSummary
        buckets={report.buckets}
        total={report.totalOutstanding}
        overdueCount={overdueCount}
        noun="invoice"
        currency={currency}
        totalDetail={`${report.invoices.length} ${report.invoices.length === 1 ? "invoice" : "invoices"} · ${report.customers.length} ${report.customers.length === 1 ? "customer" : "customers"}`}
        age={state.age}
        // Receivables has no "Due in 7 days" card, so the age is always one of its own.
        onAgeChange={(age) => update({ age: age as ReceivablesAge | null })}
        note={
          retention && (
            <span className="flex flex-wrap items-center gap-2" data-testid="retention-note">
              <Info size={15} aria-hidden />
              {formatMoney(BigInt(retention.held), currency)} retention held on {retention.jobCount} {retention.jobCount === 1 ? "job" : "jobs"} isn&apos;t counted here — it&apos;s owed once you release it on the job.
              <SectionLink href="/jobs" className="font-medium text-primary hover:underline">
                See jobs
              </SectionLink>
            </span>
          )
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3" data-print="hide">
          <Select value={state.age ?? ALL_AGES} onValueChange={(v) => update({ age: v === ALL_AGES ? null : (v as ReceivablesAge) })}>
            <SelectTrigger aria-label="Show by age" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_AGES}>All ages</SelectItem>
              {(["overdue", "current", "0-30", "31-60", "61-90", "90+"] as const satisfies readonly (typeof RECEIVABLES_AGES)[number][]).map((a) => (
                <SelectItem key={a} value={a}>
                  {RECEIVABLES_AGE_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && (
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="receivables-updated">
                {refreshing ? "Updating…" : updatedLabel(updatedAt, now)}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="Refresh list" aria-busy={refreshing} disabled={refreshing} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh list</TooltipContent>
            </Tooltip>
            <ReportExportMenu path={`/reports/receivables${ageQuery}`} csvPath={`/reports/receivables/export.csv${ageQuery}`} search={state.q} />
          </div>
        </div>
        <p role="status" className="sr-only">
          {announcement}
        </p>
        {refreshFailed && (
          <Alert variant="critical">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              Couldn&apos;t refresh the list. Check your connection and try again.
              <Button variant="secondary" size="sm" onClick={() => void load("refresh")}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
      </div>

      {report.invoices.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<Inbox />} title="Nothing outstanding" description="Every issued invoice has been paid in full." />
        </div>
      ) : state.tab === "customer" ? (
        customers!.length === 0 ? (
          state.q.trim() ? empty("No customers match your search", () => update({ q: "" }), "Clear search") : empty(emptyAge(state.age!), () => update({ age: null }), "Show all")
        ) : (
          <ReceivablesCustomersTable
            customers={customers!}
            currency={currency}
            now={today}
            sort={state.sort}
            onSortChange={(sort) => update({ sort })}
            page={state.page}
            onPageChange={(page) => update({ page })}
            toolbarStart={search}
            actions={{
              onSendStatement: (c) => setDialog({ kind: "statement", contactId: c.contactId, email: c.email }),
              onRecordPayment: (c) => setDialog({ kind: "record", contactId: c.contactId, contactName: c.name }),
            }}
          />
        )
      ) : invoices!.length === 0 ? (
        state.q.trim() ? empty("No invoices match your search", () => update({ q: "" }), "Clear search") : empty(emptyAge(state.age!), () => update({ age: null }), "Show all")
      ) : (
        <div className="flex flex-col gap-3">
          {canRemind && selectedRows.length > 0 && (
            <ReceivablesBulkBar
              selected={selectedRows}
              onClear={() => setSelected(new Set())}
              onFinished={(title, description) => {
                setSelected(new Set());
                done(title, description);
              }}
              onFailed={(title, message) => setActionError({ title, message })}
            />
          )}
          <ReceivablesTable
            invoices={invoices!}
            now={today}
            sort={state.sort}
            onSortChange={(sort) => update({ sort })}
            page={state.page}
            onPageChange={(page) => update({ page })}
            toolbarStart={search}
            selected={canRemind ? selected : undefined}
            onSelectedChange={canRemind ? setSelected : undefined}
            actions={{
              onRecordPayment: (row) => setDialog({ kind: "record", contactId: row.contactId, contactName: row.contactName, invoiceId: row.id }),
              onApplyCredit: (row) => setDialog({ kind: "credit", row }),
              onSendReminder: (row) => setDialog({ kind: "remind", row }),
              hasCredit: (contactId) => (creditByContact.get(contactId) ?? 0n) > 0n,
            }}
          />
        </div>
      )}
    </div>
  );

  return (
    <>
      {header}
      <Tabs value={state.tab} onValueChange={(tab) => update({ tab: tab as ReceivablesTab, sort: null })}>
        <TabsList className="mb-4" data-print="hide">
          <TabsTrigger value="customer" className="group" aria-label={report ? `By customer, ${report.customers.length}` : "By customer"}>
            By customer
            {report && <Count n={report.customers.length} />}
          </TabsTrigger>
          <TabsTrigger value="invoice" className="group" aria-label={report ? `By invoice, ${report.invoices.length}` : "By invoice"}>
            By invoice
            {report && <Count n={report.invoices.length} />}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={state.tab} className="pt-0">
          {body}
        </TabsContent>
      </Tabs>

      {dialog?.kind === "record" && (
        <RecordPaymentDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          contactId={dialog.contactId}
          contactName={dialog.contactName ?? null}
          presetInvoiceId={dialog.invoiceId}
          onRecorded={(p) => done(...paymentRecordedToast(p))}
        />
      )}
      {dialog?.kind === "credit" && (
        <ApplyCustomerCreditDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          invoiceId={dialog.row.id}
          invoiceNumber={dialog.row.number}
          contactId={dialog.row.contactId}
          currency={dialog.row.currency}
          balanceDue={BigInt(dialog.row.balanceDue)}
          onApplied={(total) => done("Credit applied", `${formatMoney(total, dialog.row.currency)} of credit now counts against ${dialog.row.number ?? "the invoice"}.`)}
        />
      )}
      {dialog?.kind === "remind" && (
        <SendEmailDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={`Send payment reminder — ${dialog.row.number ?? ""}`}
          description={`${dialog.row.contactName ?? "Customer"} · ${formatMoney(BigInt(dialog.row.balanceDue), dialog.row.currency)} due`}
          draftPath={`/email-drafts/reminder/${dialog.row.id}`}
          sendLabel="Send reminder"
          pdfLabel="Attach the invoice PDF"
          onSend={(email) => sendReminder(dialog.row, email)}
        />
      )}
      {dialog?.kind === "statement" && (
        <StatementDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          contactId={dialog.contactId}
          contactEmail={dialog.email}
          onSent={(sentTo) => done("Statement sent", `Statement sent to ${sentTo}`)}
        />
      )}
    </>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="ml-1.5 rounded-full border border-border bg-surface-sunken px-1.5 text-[11px] font-semibold tabular-nums text-on-surface-muted group-data-[state=active]:border-transparent group-data-[state=active]:bg-info-bg group-data-[state=active]:text-primary">
      {n}
    </span>
  );
}
