"use client";

import { SUPPLY_CLASS_LABELS, placeOfSupplyLabel, SUPPLY_TYPE_LABELS } from "@spine/shared";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { ArrowRightLeft, Banknote, Building2, CalendarDays, ChevronDown, Clock, FileCheck, HardHat, MapPin, Pencil } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { HistorySection } from "../../../components/history-section";
import { ActionError } from "../../../components/action-error";
import { useToast } from "../../../components/toast-host";
import { AttachmentsSection } from "../../../components/attachments-section";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { calendarDate } from "../quotes/quotes-list-state";
import { RecordVendorPaymentDialog } from "../vendor-payments/record-vendor-payment-dialog";
import { VendorPaymentsSection } from "./vendor-payments-section";
import { VendorBillActivity } from "./vendor-bill-activity";
import { VoidBillDialog } from "./void-bill-dialog";
import { ApplyCreditToBillDialog } from "./apply-credit-to-bill-dialog";
import { RecurringBillDialog } from "./recurring/recurring-bill-dialog";
import { BILL_STATE_CLASS, BILL_STATE_LABELS, billRecordedToast, billState, lateLabel, owes } from "./vendor-bill-state";
import type { VendorBill } from "./types";

import { SectionLink } from "../../../components/section-link";
/**
 * US-PUR-32/US-PUR-33 (D-225) — a vendor bill's page, laid out like a
 * payment's (D-221): the bill number as the title with its state in words,
 * the vendor, bill date, due date with how late, job and place of supply;
 * one primary action (Record bill for a draft, Pay bill while money is
 * owed) with Apply credit when the vendor has credit; the rest in More with
 * their icons. A strip of Total, Paid, Credits applied and Balance due; the
 * lines with their totals; payments (each opening the payment); credits;
 * attachments; Activity. Every major action asks first and toasts.
 */
export function VendorBillDetail({ billId }: { billId: string }) {
  const router = useRouter();
  const [bill, setBill] = useState<VendorBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [voidOpen, setVoidOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openCredit, setOpenCredit] = useState<bigint>(0n);
  const [refreshKey, setRefreshKey] = useState(0);
  const canManageRecurring = useCapability("vendor_bills.manage_recurring");
  const canRecord = useCapability("vendor_bills.record");
  const canVoidRight = useCapability("vendor_bills.void");
  const canPay = useCapability("vendor_payments.edit_own");
  const canApply = useCapability("vendor_credits.apply");
  const canCreate = useCapability("vendor_bills.edit_own");
  const canCredit = useCapability("vendor_credits.edit_own");
  const canEditRight = useCanEditOwnership(bill?.createdByUserId ?? null, { own: "vendor_bills.edit_own", others: "vendor_bills.edit_others" });
  const canDeleteRight = useCanEditOwnership(bill?.createdByUserId ?? null, { own: "vendor_bills.delete_own", others: "vendor_bills.delete_others" });
  const showToast = useToast();

  const load = useCallback(() => {
    apiClient
      .get<VendorBill>(`/vendor-bills/${billId}`)
      .then((b) => {
        setBill(b);
        setRefreshKey((k) => k + 1);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load vendor bill."));
  }, [billId]);

  useEffect(() => {
    load();
  }, [load]);

  // US-PUR-33: Apply credit shows only while the vendor has open credit.
  useEffect(() => {
    if (!bill || !owes(bill)) return setOpenCredit(0n);
    apiClient
      .get<{ balanceAmount: string; currency: string }[]>(`/vendor-credits?contactId=${bill.contactId}&status=open`)
      .then((rows) => setOpenCredit(rows.filter((c) => c.currency === bill.currency).reduce((s, c) => s + BigInt(c.balanceAmount), 0n)))
      .catch(() => setOpenCredit(0n));
  }, [bill]);

  /** After an action: what happened (D-223), and the page again. */
  function done(title: string, description: string) {
    setActionError(null);
    showToast(title, description);
    load();
  }

  async function handleRecord() {
    if (!bill) return;
    const ok = await confirm({
      title: "Record this bill?",
      description: `${bill.contactName ?? "The vendor"}'s bill ${bill.billNumber} for ${formatMoney(BigInt(bill.totalAmount), bill.currency)} is posted to your books as owed. After that it can't be edited — only voided.`,
      confirmLabel: "Record bill",
    });
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await apiClient.post<VendorBill>(`/vendor-bills/${bill.id}/record`);
      done(...billRecordedToast({ ...updated, contactName: bill.contactName }));
    } catch (err) {
      setActionError({ title: "Couldn't record the bill.", message: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!bill) return;
    const ok = await confirm({ title: "Delete this draft bill?", description: `${bill.billNumber} is removed for good. This can't be undone.`, confirmLabel: "Delete draft", danger: true });
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      await apiClient.delete(`/vendor-bills/${bill.id}`);
      showToast("Draft bill deleted", `${bill.billNumber} from ${bill.contactName ?? "the vendor"} has been removed.`);
      router.push("/vendor-bills");
    } catch (err) {
      setActionError({ title: "Couldn't delete the draft.", message: err instanceof Error ? err.message : "Try again." });
      setBusy(false);
    }
  }

  if (error && !bill) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!bill) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const today = new Date();
  const locale = orgLocaleTag();
  const money = (v: string | bigint) => formatMoney(BigInt(v), bill.currency);
  const state = billState(bill, today);
  const late = lateLabel(bill, today);
  const isDraft = bill.status === "draft";
  const owed = owes(bill);
  const canEdit = isDraft && canEditRight;
  const canDelete = isDraft && canDeleteRight;
  const canVoid = bill.status === "recorded" && !bill.isOpening && canVoidRight;
  const paid = BigInt(bill.amountPaid);
  const credited = BigInt(bill.creditedAmount ?? "0");
  const items = (bill.lines ?? []).filter((l) => l.type === "item");

  type Action = { key: string; label: string; icon: React.ReactNode; onClick: () => void };
  const primary: Action | null = isDraft && canRecord ? { key: "record", label: "Record bill", icon: <FileCheck size={14} aria-hidden />, onClick: () => void handleRecord() } : owed && canPay ? { key: "pay", label: "Pay bill", icon: <Banknote size={14} aria-hidden />, onClick: () => setPayOpen(true) } : null;

  const figure = (label: string, value: string, sub: string, testId: string, tone?: string) => (
    <div className="flex flex-col gap-1 border-b border-border px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0" data-testid={testId}>
      <span className="text-[12.5px] text-on-surface-muted">{label}</span>
      <span className={cn("text-[19px] font-bold leading-tight tabular-nums", tone ?? "text-on-surface")}>{value}</span>
      <span className="text-[12px] text-on-surface-muted">{sub}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Purchases" }, { label: "Vendor bills", href: "/vendor-bills" }, { label: bill.billNumber }]} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-[18rem] flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] font-bold leading-tight tracking-tight text-on-surface">{bill.billNumber}</h1>
              <Badge className={BILL_STATE_CLASS[state]} data-testid="bill-state">
                {BILL_STATE_LABELS[state]}
              </Badge>
              {bill.isOpening && <Badge className="bg-draft-bg text-draft">Opening balance</Badge>}
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-on-surface-muted" data-testid="bill-meta">
              <span className="inline-flex items-center gap-1.5">
                <Building2 size={14} aria-hidden />
                <SectionLink href={`/contacts/${bill.contactId}`} className="font-medium text-primary hover:underline">
                  {bill.contactName ?? "Unknown vendor"}
                </SectionLink>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden />
                Bill date {calendarDate(bill.date.slice(0, 10), today, locale)}
              </span>
              {bill.dueDate && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={14} aria-hidden />
                  Due {calendarDate(bill.dueDate.slice(0, 10), today, locale)}
                  {late && <span className={cn("font-medium", state === "overdue" ? "text-overdue" : "text-due-soon")}>· {late}</span>}
                </span>
              )}
              {bill.jobId && (
                <span className="inline-flex items-center gap-1.5">
                  <HardHat size={14} aria-hidden />
                  <SectionLink href={`/jobs/${bill.jobId}`} className="font-medium text-primary hover:underline">
                    {bill.jobName ?? "The job"}
                  </SectionLink>
                </span>
              )}
              {bill.placeOfSupply && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} aria-hidden />
                  {placeOfSupplyLabel(bill.placeOfSupply)}
                  {bill.supplyType ? ` (${SUPPLY_TYPE_LABELS[bill.supplyType].toLowerCase()})` : ""}
                </span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2" data-testid="bill-actions">
            {canEdit && (
              <Button variant="secondary" asChild>
                <Link href={`/vendor-bills/${bill.id}/edit`}>
                  <Pencil size={14} aria-hidden />
                  Edit
                </Link>
              </Button>
            )}
            {owed && canApply && openCredit > 0n && (
              <Button variant="secondary" onClick={() => setCreditOpen(true)} disabled={busy}>
                <ArrowRightLeft size={14} aria-hidden />
                Apply credit
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
                {canManageRecurring && !bill.isOpening && (
                  <DropdownMenuItem onSelect={() => setRecurringOpen(true)}>
                    <MENU_ICONS.makeRecurring aria-hidden />
                    Make recurring
                  </DropdownMenuItem>
                )}
                {canCreate && !bill.isOpening && (
                  <DropdownMenuItem onSelect={() => router.push(`/vendor-bills/new?from=${bill.id}`)}>
                    <MENU_ICONS.duplicate aria-hidden />
                    Duplicate
                  </DropdownMenuItem>
                )}
                {/* US-PUR-40: a credit from this bill, its lines copied to edit down. */}
                {canCredit && bill.status === "recorded" && !bill.isOpening && (
                  <DropdownMenuItem onSelect={() => router.push(`/vendor-credits/new?billId=${bill.id}`)}>
                    <MENU_ICONS.issueCreditNote aria-hidden />
                    Record vendor credit
                  </DropdownMenuItem>
                )}
                {(canVoid || canDelete) && <DropdownMenuSeparator />}
                {canVoid && (
                  <DropdownMenuItem destructive onSelect={() => setVoidOpen(true)}>
                    <MENU_ICONS.void aria-hidden />
                    Void bill
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem destructive onSelect={() => void handleDelete()}>
                    <MENU_ICONS.delete aria-hidden />
                    Delete draft
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <HistorySection endpoint={`/vendor-bills/${bill.id}/history`} subjectLabel="this vendor bill" open={historyOpen} onOpenChange={setHistoryOpen} />
          </div>
        </div>
      </div>

      {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
      {bill.status === "void" && (
        <Alert variant="warning">
          <AlertDescription>
            Voided{bill.voidedAt && <> on {calendarDate(bill.voidedAt.slice(0, 10), today, locale)}</>}
            {bill.voidReason && <>: {bill.voidReason}</>}. It&apos;s off your books and nothing is owed on it.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-surface sm:grid-cols-4" data-testid="bill-figures">
        {figure("Total", money(bill.totalAmount), `${items.length} ${items.length === 1 ? "line" : "lines"} · tax ${money(bill.taxAmount)}`, "fig-total")}
        {figure("Paid", money(paid), paid > 0n ? "By payment" : "Nothing paid yet", "fig-paid")}
        {figure("Credits applied", money(credited), owed && openCredit > 0n ? `${money(openCredit)} credit to use` : credited > 0n ? `${(bill.creditsApplied ?? []).length} credit${(bill.creditsApplied ?? []).length === 1 ? "" : "s"}` : "None", "fig-credited")}
        {figure("Balance due", bill.status === "void" ? "—" : money(bill.balanceDue), bill.status === "void" ? "Void" : late ?? (BigInt(bill.balanceDue) > 0n ? "Owed" : "Paid in full"), "fig-balance", state === "overdue" ? "text-overdue" : owed ? "text-due-soon" : undefined)}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="p-0" data-testid="bill-lines">
            <h3 className="px-4 pb-2 pt-4 text-[14px] font-semibold text-on-surface">Lines</h3>
            {bill.isOpening && <p className="px-4 pb-3 text-[13px] text-on-surface-muted">Brought in from your old system, so it has no lines. Attach the original bill below to keep it with this one.</p>}
            <div className="flex flex-col">
              {(bill.lines ?? []).map((line) => (
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
                      </p>
                    )}
                  </div>
                  {line.type === "item" && <span className="shrink-0 tabular-nums text-on-surface">{money(line.lineTotalAmount)}</span>}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1.5 border-t border-border px-4 py-3 text-[13px]">
              <div className="flex justify-between text-on-surface-muted">
                <span>Subtotal</span>
                <span className="tabular-nums text-on-surface">{money(bill.subtotalAmount)}</span>
              </div>
              <div className="flex justify-between text-on-surface-muted">
                <span>Tax</span>
                <span className="tabular-nums text-on-surface">{money(bill.taxAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-on-surface">
                <span>Total</span>
                <span className="tabular-nums">{money(bill.totalAmount)}</span>
              </div>
            </div>
          </Card>

          <VendorPaymentsSection billId={bill.id} refreshKey={refreshKey} />
          {(bill.creditsApplied ?? []).length > 0 && (
            <Card className="flex flex-col gap-3" data-testid="credits-applied">
              <h3 className="text-[14px] font-semibold text-on-surface">Credits applied</h3>
              {bill.creditsApplied!.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 text-[13.5px]">
                  <SectionLink href={`/vendor-credits/${c.vendorCreditId}`} className="font-medium text-primary hover:underline">
                    {c.number}
                    {c.vendorReference ? ` · their ${c.vendorReference}` : ""}
                  </SectionLink>
                  <span className="tabular-nums text-on-surface">{money(c.amount)}</span>
                </div>
              ))}
            </Card>
          )}
          <AttachmentsSection entityType="vendor_bill" entityId={bill.id} />
          {bill.notes && (
            <Card className="flex flex-col gap-1">
              <h3 className="text-[14px] font-semibold text-on-surface">Notes</h3>
              <p className="whitespace-pre-wrap text-[13px] text-on-surface">{bill.notes}</p>
            </Card>
          )}
        </div>
        <VendorBillActivity billId={bill.id} currency={bill.currency} refreshKey={refreshKey} onViewHistory={() => setHistoryOpen(true)} />
      </div>

      <RecordVendorPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        initialContactId={bill.contactId}
        initialBillId={bill.id}
        onRecorded={(payment) => {
          const number = payment.number;
          done(number ? `${number} recorded` : "Payment recorded", `${bill.billNumber}'s balance has been updated.`);
        }}
      />
      <ApplyCreditToBillDialog bill={bill} open={creditOpen} onOpenChange={setCreditOpen} onApplied={(total) => done("Credit applied", `${money(total)} now counts against ${bill.billNumber}.`)} />
      <VoidBillDialog bill={bill} open={voidOpen} onOpenChange={setVoidOpen} onVoided={(updated) => done(`${updated.billNumber} voided`, "A reversing entry took it off your books.")} />
      <RecurringBillDialog
        open={recurringOpen}
        onOpenChange={setRecurringOpen}
        prefill={{
          contactId: bill.contactId,
          currency: bill.currency,
          name: bill.contactName ?? "",
          lines: (bill.lines ?? []).map((l) => ({
            id: l.id,
            sortOrder: l.sortOrder,
            type: l.type,
            catalogItemId: l.catalogItemId,
            name: l.name,
            description: l.description,
            quantity: l.quantity,
            unitPriceAmount: l.unitPriceAmount,
            accountId: l.accountId,
            taxRatePercentage: l.taxRatePercentage,
            taxRateId: l.taxRateId,
            taxGroupId: l.taxGroupId,
            isTaxInclusive: l.isTaxInclusive,
            supplyClass: l.supplyClass,
            hsnSac: l.hsnSac,
          })),
        }}
        onSaved={() => {
          setRecurringOpen(false);
          router.push("/vendor-bills/recurring");
        }}
      />
      {confirmDialog}
    </div>
  );
}
