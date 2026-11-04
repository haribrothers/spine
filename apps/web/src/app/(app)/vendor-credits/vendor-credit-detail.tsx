"use client";

import Link from "next/link";
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
  cn,
  useConfirm,
} from "@spine/ui";
import { SUPPLY_CLASS_LABELS, SUPPLY_TYPE_LABELS, placeOfSupplyLabel } from "@spine/shared";
import { ArrowRightLeft, Banknote, Building2, CalendarDays, ChevronDown, File, FileCheck, HardHat, Hash, MapPin, MoreHorizontal, Pencil } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { ActionError } from "../../../components/action-error";
import { useToast } from "../../../components/toast-host";
import { AttachmentsSection } from "../../../components/attachments-section";
import { HistorySection } from "../../../components/history-section";
import { calendarDate } from "../quotes/quotes-list-state";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "../vendor-bills/types";
import type { VendorCredit } from "./types";
import { ApplyVendorCreditDialog } from "./apply-vendor-credit-dialog";
import { VendorRefundDialog } from "./vendor-refund-dialog";
import { VoidCreditDialog } from "./void-credit-dialog";
import { VendorCreditActivity } from "./vendor-credit-activity";
import { CREDIT_STATE_CLASS, CREDIT_STATE_LABELS, creditRecordedToast, creditState, creditUse, hasCreditLeft } from "./vendor-credit-state";

import { SectionLink } from "../../../components/section-link";
import { useLoadFailure } from "../../../lib/use-load-failure";

/** A credit's state in words — never colour alone (US-PUR-37). */
export function CreditStateBadge({ credit, testId }: { credit: Pick<VendorCredit, "status" | "totalAmount" | "balanceAmount">; testId?: string }) {
  const state = creditState(credit);
  return (
    <Badge className={CREDIT_STATE_CLASS[state]} data-testid={testId}>
      {CREDIT_STATE_LABELS[state]}
    </Badge>
  );
}

/**
 * US-PUR-37 (D-226) — a vendor credit's page, laid out like a bill's
 * (D-225): its number as the title with its state in words, the vendor,
 * their credit note number, the date, the bill it's against, the job and
 * place of supply; one primary action (Record credit for a draft, Apply to
 * bills while credit is left) with Record refund beside it; the rest in
 * More with their icons. A strip of Total, Applied to bills, Refunded and
 * Left to use; the lines; where it was applied and its refunds; attachments;
 * Activity. Every major action asks first, and every action toasts.
 */
export function VendorCreditDetail({ creditId }: { creditId: string }) {
  const loadFailed = useLoadFailure(creditId);
  const router = useRouter();
  const [credit, setCredit] = useState<VendorCredit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const showToast = useToast();
  const canRecord = useCapability("vendor_credits.record");
  const canApply = useCapability("vendor_credits.apply");
  const canVoidRight = useCapability("vendor_credits.void");
  const [applyOpen, setApplyOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const canEditRight = useCanEditOwnership(credit?.createdByUserId ?? null, { own: "vendor_credits.edit_own", others: "vendor_credits.edit_others" });
  const canDeleteRight = useCanEditOwnership(credit?.createdByUserId ?? null, { own: "vendor_credits.delete_own", others: "vendor_credits.delete_others" });

  const load = useCallback(() => {
    apiClient
      .get<VendorCredit>(`/vendor-credits/${creditId}`)
      .then((c) => {
        setCredit(c);
        setRefreshKey((k) => k + 1);
      })
      .catch((err) => loadFailed(err) || setError(err instanceof Error ? err.message : "Couldn't load this vendor credit."));
  }, [creditId]);

  useEffect(() => {
    load();
  }, [load]);

  /** After an action: what happened (D-223), and the page again. */
  function done(title: string, description: string) {
    setActionError(null);
    showToast(title, description);
    load();
  }

  /** Runs an action that asks first (D-218); errors stay on the page. */
  async function act(question: Parameters<typeof confirm>[0], action: () => Promise<void>, failed: string) {
    if (!(await confirm(question))) return;
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError({ title: failed, message: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(false);
    }
  }

  if (!credit) {
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
  const money = (v: string | bigint) => formatMoney(BigInt(v), credit.currency);
  const vendor = credit.contactName ?? "the vendor";
  const title = credit.number ?? "Draft vendor credit";
  const isDraft = credit.status === "draft";
  const isVoid = credit.status === "void";
  const left = hasCreditLeft(credit);
  const { applied, refunded } = creditUse(credit);
  const canEdit = isDraft && canEditRight;
  const canDelete = isDraft && canDeleteRight;
  const canVoid = (credit.status === "open" || credit.status === "used") && !credit.isOpening && canVoidRight;
  const items = (credit.lines ?? []).filter((l) => l.type === "item");
  const allocations = credit.allocations ?? [];
  const refunds = credit.refunds ?? [];

  const record = () =>
    act(
      {
        title: "Record this vendor credit?",
        description: `${money(credit.totalAmount)} from ${vendor} is posted to your books, lowering what you owe them. After that it can't be edited — only voided.`,
        confirmLabel: "Record credit",
      },
      async () => {
        const updated = await apiClient.post<VendorCredit>(`/vendor-credits/${credit.id}/record`);
        done(...creditRecordedToast({ ...updated, contactName: credit.contactName }));
      },
      "Couldn't record the credit.",
    );

  const remove = () =>
    act(
      { title: "Delete this draft credit?", description: `${vendor}'s credit note ${credit.vendorReference ?? ""} is removed for good. This can't be undone.`, confirmLabel: "Delete draft", danger: true },
      async () => {
        await apiClient.delete(`/vendor-credits/${credit.id}`);
        showToast("Draft credit deleted", `${vendor}'s credit note ${credit.vendorReference ?? ""} has been removed.`);
        router.push("/vendor-credits");
      },
      "Couldn't delete the draft.",
    );

  const primary = isDraft && canRecord ? { label: "Record credit", icon: <FileCheck size={14} aria-hidden />, onClick: () => void record() } : left && canApply ? { label: "Apply to bills", icon: <ArrowRightLeft size={14} aria-hidden />, onClick: () => setApplyOpen(true) } : null;

  const figure = (label: string, value: string, sub: string, testId: string, tone?: string) => (
    <div className="flex flex-col gap-1 border-b border-border px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0" data-testid={testId}>
      <span className="text-[12.5px] text-on-surface-muted">{label}</span>
      <span className={cn("text-[19px] font-bold leading-tight tabular-nums", tone ?? "text-on-surface")}>{value}</span>
      <span className="text-[12px] text-on-surface-muted">{sub}</span>
    </div>
  );
  const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  const liveRefunds = refunds.filter((r) => !r.deletedAt);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Purchases" }, { label: "Vendor credits", href: "/vendor-credits" }, { label: title }]} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-[18rem] flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] font-bold leading-tight tracking-tight text-on-surface">{title}</h1>
              <CreditStateBadge credit={credit} testId="credit-state" />
              {credit.isOpening && <Badge className="bg-draft-bg text-draft">Opening balance</Badge>}
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-on-surface-muted" data-testid="credit-meta">
              <span className="inline-flex items-center gap-1.5">
                <Building2 size={14} aria-hidden />
                <SectionLink href={`/contacts/${credit.contactId}`} className="font-medium text-primary hover:underline">
                  {credit.contactName ?? "Unknown vendor"}
                </SectionLink>
              </span>
              {credit.vendorReference && (
                <span className="inline-flex items-center gap-1.5">
                  <Hash size={14} aria-hidden />
                  Their {credit.vendorReference}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden />
                {calendarDate(credit.date.slice(0, 10), today, locale)}
              </span>
              {credit.billId && (
                <span className="inline-flex items-center gap-1.5">
                  <File size={14} aria-hidden />
                  Against{" "}
                  <SectionLink href={`/vendor-bills/${credit.billId}`} className="font-medium text-primary hover:underline">
                    {credit.billNumber ?? "a bill"}
                  </SectionLink>
                </span>
              )}
              {credit.jobId && (
                <span className="inline-flex items-center gap-1.5">
                  <HardHat size={14} aria-hidden />
                  <SectionLink href={`/jobs/${credit.jobId}`} className="font-medium text-primary hover:underline">
                    {credit.jobName ?? "The job"}
                  </SectionLink>
                </span>
              )}
              {credit.placeOfSupply && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} aria-hidden />
                  {placeOfSupplyLabel(credit.placeOfSupply)}
                  {credit.supplyType ? ` (${SUPPLY_TYPE_LABELS[credit.supplyType].toLowerCase()})` : ""}
                </span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2" data-testid="credit-actions">
            {canEdit && (
              <Button variant="secondary" asChild>
                <Link href={`/vendor-credits/${credit.id}/edit`}>
                  <Pencil size={14} aria-hidden />
                  Edit
                </Link>
              </Button>
            )}
            {left && canApply && (
              <Button variant="secondary" onClick={() => setRefundOpen(true)} disabled={busy}>
                <Banknote size={14} aria-hidden />
                Record refund
              </Button>
            )}
            {primary && (
              <Button onClick={primary.onClick} disabled={busy}>
                {busy ? <Spinner size="sm" /> : primary.icon}
                {primary.label}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  More <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                  <MENU_ICONS.history aria-hidden />
                  View history
                </DropdownMenuItem>
                {(canVoid || canDelete) && <DropdownMenuSeparator />}
                {canVoid && (
                  <DropdownMenuItem destructive onSelect={() => setVoidOpen(true)}>
                    <MENU_ICONS.void aria-hidden />
                    Void credit
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem destructive onSelect={() => void remove()}>
                    <MENU_ICONS.delete aria-hidden />
                    Delete draft
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <HistorySection endpoint={`/vendor-credits/${credit.id}/history`} subjectLabel="this vendor credit" open={historyOpen} onOpenChange={setHistoryOpen} />
          </div>
        </div>
      </div>

      {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
      {isVoid && (
        <Alert variant="warning">
          <AlertDescription data-testid="credit-void-reason">
            Void{credit.voidReason ? ` — ${credit.voidReason}` : ""}. It&apos;s off your books and can&apos;t be used.
          </AlertDescription>
        </Alert>
      )}

      {!isDraft && (
        <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-surface sm:grid-cols-4" data-testid="credit-figures">
          {figure("Total", money(credit.totalAmount), `${count(items.length, "line")} · tax ${money(credit.taxAmount)}`, "fig-total")}
          {figure("Applied to bills", money(applied), allocations.length ? count(allocations.length, "bill") : "Not applied yet", "fig-applied")}
          {figure("Refunded", money(refunded), liveRefunds.length ? count(liveRefunds.length, "refund") : "No refunds", "fig-refunded")}
          {figure("Left to use", isVoid ? "—" : money(credit.balanceAmount), isVoid ? "Void" : left ? "Apply it or ask for a refund" : "All used", "fig-left", left ? "text-primary" : undefined)}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="p-0" data-testid="credit-lines">
            <h3 className="px-4 pb-2 pt-4 text-[14px] font-semibold text-on-surface">Lines</h3>
            {credit.isOpening && <p className="px-4 pb-3 text-[13px] text-on-surface-muted">Brought in from your old system, so it has no lines.</p>}
            <div className="flex flex-col">
              {(credit.lines ?? []).map((line) => (
                <div key={line.id} className="flex items-start justify-between gap-4 border-t border-border px-4 py-3">
                  <div className="min-w-0">
                    <p className={cn("text-[13.5px] text-on-surface", line.type === "heading" && "font-semibold")}>{line.name}</p>
                    {line.description && <p className="text-[12.5px] text-on-surface-muted">{line.description}</p>}
                    {line.type === "item" && (
                      <p className="text-[12px] text-on-surface-muted">
                        {line.quantity} × {money(line.unitPriceAmount)}
                        {line.taxRatePercentage > 0 && <> · {line.taxRatePercentage}% tax</>}
                        {line.supplyClass && line.supplyClass !== "taxable" && <> · {SUPPLY_CLASS_LABELS[line.supplyClass]}</>}
                        {line.hsnSac && <> · {line.hsnSac}</>}
                        {line.accountName && <> · {line.accountCode ? `${line.accountCode} ` : ""}{line.accountName}</>}
                      </p>
                    )}
                  </div>
                  {line.type === "item" && <span className="shrink-0 tabular-nums text-on-surface">{money(line.lineSubtotalAmount)}</span>}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1.5 border-t border-border px-4 py-3 text-[13px]">
              <div className="flex justify-between text-on-surface-muted">
                <span>Subtotal</span>
                <span className="tabular-nums text-on-surface">{money(credit.subtotalAmount)}</span>
              </div>
              <div className="flex justify-between text-on-surface-muted">
                <span>Tax</span>
                <span className="tabular-nums text-on-surface">{money(credit.taxAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-on-surface">
                <span>Total credit</span>
                <span className="tabular-nums">{money(credit.totalAmount)}</span>
              </div>
            </div>
          </Card>

          {!isDraft && (
            <Card className="p-0" data-testid="credit-allocations">
              <h3 className="px-4 pb-2 pt-4 text-[14px] font-semibold text-on-surface">Applied to bills</h3>
              {allocations.length === 0 ? (
                <p className="border-t border-border px-4 py-3 text-[13px] text-on-surface-muted">{left ? "Not applied yet. Apply it to cut what you owe on a bill." : "Nothing was applied to a bill."}</p>
              ) : (
                allocations.map((a) => (
                  <div key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto_32px] items-center gap-4 border-t border-border px-4 py-2.5 text-[13.5px]" data-testid="credit-allocation">
                    <SectionLink href={`/vendor-bills/${a.billId}`} className="font-medium text-primary hover:underline">
                      {a.billNumber}
                    </SectionLink>
                    <span className="text-[12.5px] text-on-surface-muted">{calendarDate(a.createdAt.slice(0, 10), today, locale)}</span>
                    <span className="tabular-nums text-on-surface">{money(a.amount)}</span>
                    {canApply && !isVoid ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" aria-label={`Actions for ${a.billNumber}`} className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface">
                            <MoreHorizontal size={16} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            destructive
                            onSelect={() =>
                              void act(
                                {
                                  title: `Remove this credit from ${a.billNumber}?`,
                                  description: `${a.billNumber} owes ${money(a.amount)} more again, and the credit has that much back to use.`,
                                  confirmLabel: "Remove from bill",
                                  danger: true,
                                },
                                async () => {
                                  await apiClient.delete(`/vendor-credits/${credit.id}/allocations/${a.id}`);
                                  done("Removed from bill", `${money(a.amount)} is back on ${title}, and ${a.billNumber} owes that much again.`);
                                },
                                "Couldn't remove the credit from the bill.",
                              )
                            }
                          >
                            <MENU_ICONS.moveOff aria-hidden />
                            Remove from bill
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span />
                    )}
                  </div>
                ))
              )}
            </Card>
          )}

          {!isDraft && (
            <Card className="p-0" data-testid="vendor-refunds">
              <h3 className="px-4 pb-2 pt-4 text-[14px] font-semibold text-on-surface">Refunds</h3>
              {refunds.length === 0 ? (
                <p className="border-t border-border px-4 py-3 text-[13px] text-on-surface-muted">{left ? `None yet. Record a refund when ${vendor} pays you back.` : "None."}</p>
              ) : (
                refunds.map((r) => (
                  <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto_32px] items-center gap-4 border-t border-border px-4 py-2.5 text-[13.5px]">
                    <span className={r.deletedAt ? "text-on-surface-muted line-through" : "text-on-surface"}>
                      {calendarDate(r.date.slice(0, 10), today, locale)} · {PAYMENT_METHOD_LABELS[r.method as PaymentMethod] ?? r.method} into {r.moneyAccountName}
                      {r.reference ? ` · ${r.reference}` : ""}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-on-surface">{money(r.amount)}</span>
                      {r.deletedAt && <span className="text-[12px] text-on-surface-muted">Deleted</span>}
                    </span>
                    {!r.deletedAt && canApply ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" aria-label={`Actions for the ${money(r.amount)} refund`} className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface">
                            <MoreHorizontal size={16} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            destructive
                            onSelect={() =>
                              void act(
                                {
                                  title: "Delete this refund?",
                                  description: `The ${money(r.amount)} refund into ${r.moneyAccountName} is reversed in your books, and the credit has that much back to use. It stays listed, marked deleted.`,
                                  confirmLabel: "Delete refund",
                                  danger: true,
                                },
                                async () => {
                                  await apiClient.delete(`/vendor-refunds/${r.id}`);
                                  done("Refund deleted", `${money(r.amount)} is back on ${title} to use.`);
                                },
                                "Couldn't delete the refund.",
                              )
                            }
                          >
                            <MENU_ICONS.delete aria-hidden />
                            Delete refund
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span />
                    )}
                  </div>
                ))
              )}
            </Card>
          )}

          <AttachmentsSection entityType="vendor_credit" entityId={credit.id} />
          {credit.notes && (
            <Card className="flex flex-col gap-1">
              <h3 className="text-[14px] font-semibold text-on-surface">Notes</h3>
              <p className="whitespace-pre-wrap text-[13px] text-on-surface">{credit.notes}</p>
            </Card>
          )}
        </div>
        <VendorCreditActivity creditId={credit.id} currency={credit.currency} vendor={vendor} refreshKey={refreshKey} onViewHistory={() => setHistoryOpen(true)} />
      </div>

      <ApplyVendorCreditDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        credit={credit}
        onApplied={(total, bills) => done("Credit applied", `${money(total)} of ${title} now counts against ${bills === 1 ? "1 bill" : `${bills} bills`}.`)}
      />
      <VendorRefundDialog open={refundOpen} onOpenChange={setRefundOpen} credit={credit} onRecorded={(amount) => done("Refund recorded", `${money(amount)} from ${vendor} is in your books.`)} />
      <VoidCreditDialog credit={credit} open={voidOpen} onOpenChange={setVoidOpen} onVoided={() => done(`${title} voided`, `A reversing entry took it off your books, so what you owe ${vendor} went back up.`)} />
      {confirmDialog}
    </div>
  );
}
