"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Badge,
  Breadcrumb,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner,
  useConfirm,
} from "@spine/ui";
import { Building2, CalendarDays, Check, CheckCheck, ChevronDown, CircleX, HardHat, Info, Paperclip, Pencil, Receipt, Tag, User, Wallet, X } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { useMyRole } from "../../../lib/role-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { ActionError } from "../../../components/action-error";
import { useToast } from "../../../components/toast-host";
import { AttachmentsSection } from "../../../components/attachments-section";
import { HistorySection } from "../../../components/history-section";
import { calendarDate } from "../quotes/quotes-list-state";
import { ExpenseForm } from "./expense-form";
import { ExpenseActivity } from "./expense-activity";
import { ApproveExpenseDialog, RejectExpenseDialog } from "./expense-review-dialogs";
import { ReceiptPreview } from "./receipt-preview";
import { expenseLabel } from "./expense-row-actions";
import { EXPENSE_STATE_CLASS, EXPENSE_STATE_LABELS, canReviewThis, expenseState, nextWaiting, readyToBill } from "./expense-state";
import type { Expense } from "./types";

import { SectionLink } from "../../../components/section-link";
import { useLoadFailure } from "../../../lib/use-load-failure";
import { useT } from "../../../lib/i18n";
/**
 * US-PUR-43/US-PUR-45 (D-227) — an expense on its own page, laid out like a
 * bill's (D-225): its number (or "Expense" before approval) as the title,
 * its state in words; the category, date, who submitted it, job and who
 * paid; one primary action — Approve while it waits on me (with Reject and
 * "Approve and next"), Bill to customer when it's ready, Fix and resubmit on
 * my rejected one, Edit on my waiting one — and the rest in More. A strip of
 * Amount, Tax, Paid from and Billable; the receipt previewed beside the
 * details (or the labour rows); attachments; Activity.
 */
export function ExpenseDetail({ expenseId, currentUserId }: { expenseId: string; currentUserId: string | null }) {
  const t = useT();
  const loadFailed = useLoadFailure(expenseId);
  const router = useRouter();
  const role = useMyRole();
  const isOwner = role === "owner";
  const isField = role === "field";
  const showToast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [approveMode, setApproveMode] = useState<"one" | "next" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const canApproveRight = useCapability("expenses.approve");
  const canRejectRight = useCapability("expenses.reject");
  const canBillRight = useCapability("expenses.bill_to_customer");
  const canEditRight = useCanEditOwnership(expense?.submittedByUserId ?? null, { own: "expenses.edit_own", others: "expenses.edit_others" });
  const canDeleteRight = useCanEditOwnership(expense?.submittedByUserId ?? null, { own: "expenses.delete_own", others: "expenses.delete_others" });

  const load = useCallback(() => {
    apiClient
      .get<Expense>(`/expenses/${expenseId}`)
      .then((e) => {
        setExpense(e);
        setRefreshKey((k) => k + 1);
      })
      .catch((err) => loadFailed(err) || setError(err instanceof Error ? err.message : t("expenses.detail.loadFailed")));
  }, [expenseId]);

  useEffect(() => {
    load();
  }, [load]);

  function done(title: string, description: string) {
    setActionError(null);
    showToast(title, description);
    load();
  }

  if (!expense) {
    return error ? (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    ) : (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const today = new Date();
  const locale = orgLocaleTag();
  const money = (v: string | bigint) => formatMoney(BigInt(v), expense.currency);
  const state = expenseState(expense);
  const mine = expense.submittedByUserId === currentUserId;
  const title = expense.number ?? t("expenses.common.expense");
  const label = expenseLabel(expense);
  const reviewable = canReviewThis(expense, currentUserId, isOwner);
  const canApprove = reviewable && canApproveRight;
  const canReject = reviewable && canRejectRight;
  const canEdit = (expense.status === "submitted" || expense.status === "rejected") && canEditRight;
  const canDelete = expense.status === "submitted" && canDeleteRight;
  const canBill = readyToBill(expense) && !!expense.jobId && canBillRight;
  const billableNoJob = readyToBill(expense) && !expense.jobId;
  const labour = expense.entryMode === "labour" && (expense.labourLines?.length ?? 0) > 0;
  const workers = (expense.labourLines ?? []).reduce((sum, l) => sum + l.headcount, 0);
  const editIsPrimary = canEdit && !canApprove && !canBill;

  async function approveAndNext() {
    // US-PUR-43: open the next expense waiting on me, oldest first.
    const waiting = await apiClient.get<Expense[]>("/expenses?status=submitted").catch(() => [] as Expense[]);
    const next = nextWaiting(waiting, expense!.id, currentUserId, isOwner);
    if (next) {
      showToast(t("expenses.common.approvedName", { name: title }), t("expenses.detail.openingNext", { label: expenseLabel(next) }));
      router.push(`/expenses/${next.id}`);
    } else {
      done(t("expenses.detail.expenseApproved"), t("expenses.detail.lastOne"));
    }
  }

  async function bill() {
    const ok = await confirm({
      title: t("expenses.actions.billTitle"),
      description: t("expenses.actions.billDescription", { amount: money(expense!.amount), job: expense!.jobName ?? t("expenses.actions.theJob") }),
      confirmLabel: t("expenses.actions.createInvoice"),
    });
    if (!ok) return;
    setBusy(true);
    try {
      const invoice = await apiClient.post<{ id: string }>(`/expenses/${expense!.id}/bill-to-customer`);
      showToast(t("expenses.actions.invoiceDrafted"), t("expenses.actions.invoiceDraftedDescription", { label, amount: money(expense!.amount) }));
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setActionError({ title: t("expenses.detail.billFailed"), message: err instanceof Error ? err.message : t("expenses.common.tryAgain") });
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirm({ title: t("expenses.actions.deleteTitle"), description: t("expenses.actions.deleteDescription", { label, amount: money(expense!.amount) }), confirmLabel: t("expenses.actions.deleteExpense"), danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      await apiClient.delete(`/expenses/${expense!.id}`);
      showToast(t("expenses.actions.deleted"), t("expenses.actions.deletedDescription", { label, amount: money(expense!.amount) }));
      router.push("/expenses");
    } catch (err) {
      setActionError({ title: t("expenses.detail.deleteFailed"), message: err instanceof Error ? err.message : t("expenses.common.tryAgain") });
      setBusy(false);
    }
  }

  const figure = (name: string, value: React.ReactNode, sub: React.ReactNode, testId: string) => (
    <div className="flex flex-col gap-1 border-b border-border px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0" data-testid={testId}>
      <span className="text-[12.5px] text-on-surface-muted">{name}</span>
      <span className="text-[19px] font-bold leading-tight tabular-nums text-on-surface">{value}</span>
      <span className="text-[12px] text-on-surface-muted">{sub}</span>
    </div>
  );
  const taxRateName = BigInt(expense.taxAmount) > 0n ? t("expenses.detail.includedInAmount") : t("expenses.detail.noTax");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: t("expenses.common.purchases") }, { label: t("expenses.common.expenses"), href: "/expenses" }, { label: title }]} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-[18rem] flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] font-bold leading-tight tracking-tight text-on-surface">{title}</h1>
              <Badge className={EXPENSE_STATE_CLASS[state]} data-testid="expense-state">
                {EXPENSE_STATE_LABELS[state]}
              </Badge>
              {expense.isBillable && state !== "billed" && <Badge className="border border-border bg-transparent text-on-surface-muted">{t("expenses.common.billable")}</Badge>}
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-on-surface-muted" data-testid="expense-meta">
              <span className="inline-flex items-center gap-1.5">
                <Tag size={14} aria-hidden />
                {expense.categoryName ?? t("expenses.detail.noCategory")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden />
                {calendarDate(expense.date.slice(0, 10), today, locale)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <User size={14} aria-hidden />
                {t("expenses.detail.submittedBy", { name: mine ? t("expenses.detail.you") : (expense.submittedByName ?? t("expenses.detail.someone")) })}
              </span>
              {expense.jobId && (
                <span className="inline-flex items-center gap-1.5">
                  <HardHat size={14} aria-hidden />
                  <SectionLink href={`/jobs/${expense.jobId}`} className="font-medium text-primary hover:underline">
                    {expense.jobName ?? t("expenses.detail.theJob")}
                  </SectionLink>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                {expense.paidBy === "employee" ? <Wallet size={14} aria-hidden /> : <Building2 size={14} aria-hidden />}
                {expense.paidBy === "employee" ? t("expenses.detail.paidByEmployee") : t("expenses.detail.paidByCompany")}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2" data-testid="expense-actions">
            {canReject && (
              <Button variant="secondary" onClick={() => setRejectOpen(true)} disabled={busy}>
                <X size={14} aria-hidden />
                {t("expenses.common.reject")}
              </Button>
            )}
            {canApprove && (
              <Button variant="secondary" onClick={() => setApproveMode("next")} disabled={busy}>
                <CheckCheck size={14} aria-hidden />
                {t("expenses.detail.approveAndNext")}
              </Button>
            )}
            {canApprove && (
              <Button onClick={() => setApproveMode("one")} disabled={busy}>
                <Check size={14} aria-hidden />
                {t("expenses.common.approve")}
              </Button>
            )}
            {canBill && (
              <Button onClick={() => void bill()} disabled={busy}>
                <Receipt size={14} aria-hidden />
                {t("expenses.common.billToCustomer")}
              </Button>
            )}
            {editIsPrimary && (
              <Button onClick={() => setEditOpen(true)} disabled={busy}>
                <Pencil size={14} aria-hidden />
                {expense.status === "rejected" ? t("expenses.common.fixAndResubmit") : t("expenses.common.edit")}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  {t("expenses.detail.more")} <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && !editIsPrimary && (
                  <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                    <MENU_ICONS.edit aria-hidden />
                    {expense.status === "rejected" ? t("expenses.common.fixAndResubmit") : t("expenses.common.edit")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                  <MENU_ICONS.history aria-hidden />
                  {t("expenses.common.viewHistory")}
                </DropdownMenuItem>
                {canDelete && <DropdownMenuSeparator />}
                {canDelete && (
                  <DropdownMenuItem destructive onSelect={() => void remove()}>
                    <MENU_ICONS.delete aria-hidden />
                    {t("expenses.actions.deleteExpense")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <HistorySection endpoint={`/expenses/${expense.id}/history`} subjectLabel={t("expenses.detail.subjectLabel")} open={historyOpen} onOpenChange={setHistoryOpen} />
          </div>
        </div>
      </div>

      {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
      {expense.status === "rejected" && expense.reviewComment && (
        <div className="flex items-start gap-2.5 rounded-lg bg-overdue-bg px-4 py-3 text-[13px] text-on-surface" data-testid="expense-rejection">
          <CircleX size={16} aria-hidden className="mt-0.5 shrink-0 text-overdue" />
          <span>
            <b>{t("expenses.detail.rejectedHeading", { by: expense.reviewerName ? t("expenses.common.byName", { name: expense.reviewerName }) : "", on: expense.rejectedAt ? t("expenses.detail.rejectedOn", { date: calendarDate(expense.rejectedAt.slice(0, 10), today, locale) }) : "" })}</b> {t("expenses.common.quoted", { text: expense.reviewComment })}{" "}
            {canEdit ? t("expenses.detail.fixHint") : ""}
          </span>
        </div>
      )}
      {expense.status === "submitted" && mine && !isOwner && (canApproveRight || canRejectRight) && (
        <p className="text-[13px] text-on-surface-muted" data-testid="self-review-note">
          {t("expenses.detail.selfReviewNote")}
        </p>
      )}
      {billableNoJob && (
        <Alert variant="info">
          <AlertDescription>{t("expenses.detail.billableNoJob")}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-surface md:grid-cols-4" data-testid="expense-figures">
        {/* eslint-disable i18next/no-literal-string -- figure()'s last argument is a test id, not copy */}
        {figure(t("expenses.detail.amount"), money(expense.amount), labour ? `${t("expenses.labour.workers", { count: workers })} · ${t("expenses.labour.trades", { count: expense.labourLines!.length })}` : (expense.description ?? expense.categoryName ?? ""), "fig-amount")}
        {figure(t("expenses.detail.tax"), money(expense.taxAmount), taxRateName, "fig-tax")}
        {!isField
          ? figure(t("expenses.detail.paidFrom"), expense.moneyAccount?.name ?? t("expenses.detail.chosenWhenApproved"), expense.status === "approved" ? t("expenses.detail.posted", { date: expense.approvedAt ? calendarDate(expense.approvedAt.slice(0, 10), today, locale) : "" }) : t("expenses.detail.canChange"), "fig-paid-from")
          : figure(t("expenses.detail.paidBy"), expense.paidBy === "employee" ? t("expenses.detail.youCapital") : t("expenses.detail.company"), expense.paidBy === "employee" ? t("expenses.detail.reimbursable") : "", "fig-paid-from")}
        {figure(
          t("expenses.common.billable"),
          expense.isBillable ? t("expenses.detail.yes") : t("expenses.detail.no"),
          expense.billedInvoiceId ? (
            <>
              {t("expenses.detail.billedOn")}{" "}
              <SectionLink href={`/invoices/${expense.billedInvoiceId}`} className="font-medium text-primary hover:underline">
                {expense.billedInvoiceNumber ?? t("expenses.detail.anInvoice")}
              </SectionLink>
            </>
          ) : readyToBill(expense) ? (
            t("expenses.detail.readyToBill")
          ) : expense.isBillable ? (
            t("expenses.detail.billedOnceApproved")
          ) : (
            t("expenses.detail.notBilled")
          ),
          "fig-billable",
        )}
        {/* eslint-enable i18next/no-literal-string */}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          {labour && (
            <Card className="p-0" data-testid="expense-labour">
              <h3 className="px-4 pb-2 pt-4 text-[14px] font-semibold text-on-surface">{t("expenses.labour.title")}</h3>
              <div className="grid grid-cols-[minmax(0,1fr)_80px_120px_130px] gap-3 border-t border-border bg-surface-sunken px-4 py-2 text-[12px] font-medium text-on-surface-muted">
                <span>{t("expenses.labour.trade")}</span>
                <span className="text-right">{t("expenses.labour.workers")}</span>
                <span className="text-right">{t("expenses.labour.dayRate")}</span>
                <span className="text-right">{t("expenses.labour.total")}</span>
              </div>
              {expense.labourLines!.map((line) => (
                <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_80px_120px_130px] gap-3 border-t border-border px-4 py-2.5 text-[13.5px] text-on-surface">
                  <span>{line.trade}</span>
                  <span className="text-right tabular-nums">{line.headcount}</span>
                  <span className="text-right tabular-nums">{money(line.dayRateAmount)}</span>
                  <span className="text-right tabular-nums">{money(line.lineAmount)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border px-4 py-2.5 text-[13.5px] font-semibold text-on-surface">
                <span className="font-normal text-on-surface-muted">
                  {t("expenses.labour.totalForDay", { count: workers })}
                </span>
                <span className="tabular-nums">{money(expense.amount)}</span>
              </div>
              <p className="flex items-center gap-2 border-t border-border px-4 py-3 text-[12.5px] text-on-surface-muted">
                <Info size={14} aria-hidden />
                {t("expenses.labour.privacyNote")}
              </p>
            </Card>
          )}

          <Card className="p-0" data-testid="expense-receipt">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <h3 className="text-[14px] font-semibold text-on-surface">{expense.receiptFileId ? t("expenses.detail.receipt") : t("expenses.detail.details")}</h3>
            </div>
            <div className={`grid gap-5 border-t border-border p-4 ${expense.receiptFileId ? "grid-cols-1 sm:grid-cols-[220px_minmax(0,1fr)]" : "grid-cols-1"}`}>
              {expense.receiptFileId && <ReceiptPreview fileId={expense.receiptFileId} className="h-72 w-full sm:w-[220px]" />}
              <dl className="flex flex-col gap-3 text-[13px] text-on-surface">
                <div>
                  <dt className="text-[12px] text-on-surface-muted">{t("expenses.detail.description")}</dt>
                  <dd>{expense.description || t("expenses.detail.noDescription")}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-on-surface-muted">{t("expenses.detail.category")}</dt>
                  <dd>
                    {expense.categoryName ?? "—"}
                    {expense.categoryAccount ? t("expenses.detail.postsTo", { account: expense.categoryAccount }) : ""}
                  </dd>
                </div>
                {expense.reviewComment && expense.status === "approved" && (
                  <div>
                    <dt className="text-[12px] text-on-surface-muted">{t("expenses.detail.reviewComment")}</dt>
                    <dd>
                      {t("expenses.common.quoted", { text: expense.reviewComment })}{expense.reviewerName ? t("expenses.detail.reviewer", { name: expense.reviewerName }) : ""}
                    </dd>
                  </div>
                )}
              </dl>
              {/* US-OPS-17: a note, not a term and its value, so it sits after the list. */}
              {!expense.receiptFileId && (
                <p className="mt-3 flex items-center gap-2 text-[13px] text-on-surface-muted">
                  <Paperclip size={14} aria-hidden />
                  {labour ? t("expenses.detail.noReceiptLabour") : t("expenses.detail.noReceipt")}
                </p>
              )}
            </div>
          </Card>

          <AttachmentsSection entityType="expense" entityId={expense.id} />
        </div>
        <ExpenseActivity expenseId={expense.id} currency={expense.currency} refreshKey={refreshKey} onViewHistory={() => setHistoryOpen(true)} />
      </div>

      {approveMode && (
        <ApproveExpenseDialog
          expense={expense}
          open
          confirmLabel={approveMode === "next" ? t("expenses.detail.approveAndNext") : t("expenses.common.approve")}
          onOpenChange={(open) => !open && setApproveMode(null)}
          onApproved={(updated) => {
            const mode = approveMode;
            setApproveMode(null);
            if (mode === "next") void approveAndNext();
            else done(t("expenses.common.approvedName", { name: updated.number ?? t("expenses.common.expense") }), t("expenses.common.postedToBooks", { amount: money(updated.amount) }));
          }}
        />
      )}
      <RejectExpenseDialog
        expense={expense}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onRejected={() => done(t("expenses.common.expenseRejected"), t("expenses.common.rejectedDescription", { label, who: expense.submittedByName ?? t("expenses.common.theSubmitter") }))}
      />
      <ExpenseForm
        open={editOpen}
        onOpenChange={setEditOpen}
        expense={expense}
        onSaved={(updated, mode) =>
          done(mode === "resubmitted" ? t("expenses.common.expenseResubmitted") : t("expenses.common.expenseUpdated"), mode === "resubmitted" ? t("expenses.detail.waitingAgain", { label: expenseLabel(updated) }) : t("expenses.common.stillWaiting", { label: expenseLabel(updated) }))
        }
      />
      {confirmDialog}
    </div>
  );
}
