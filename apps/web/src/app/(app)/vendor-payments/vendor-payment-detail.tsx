"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  AlertDescription,
  Breadcrumb,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner,
  useConfirm,
} from "@spine/ui";
import { ArrowRightLeft, Building2, CalendarDays, ChevronDown, Download, Hash, Landmark, Mail } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { filenameFrom, saveBlob } from "../../../lib/save-file";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { HistorySection } from "../../../components/history-section";
import { AttachmentsSection } from "../../../components/attachments-section";
import { ActionError } from "../../../components/action-error";
import { useToast } from "../../../components/toast-host";
import { calendarDate } from "../quotes/quotes-list-state";
import { RemittanceEmailDialog } from "./remittance-email-dialog";
import { VendorPaymentActivity } from "./vendor-payment-activity";
import { PAYMENT_METHOD_LABELS, type VendorPaymentDetailData } from "./types";

/**
 * A vendor payment's page (US-PUR-49, US-PUR-50, US-PUR-54, D-229),
 * replacing the drawer. The number is the title, with the vendor, date,
 * method, the account it was paid from and the reference. Email remittance
 * advice is the next step (when the vendor has an address and email is set
 * up), with Download beside it and View history and Delete under More. A
 * strip reads Paid and Bills paid; "Paid to" lists each bill with what this
 * payment put on it, what it still owes and its due date. Delete asks
 * first and names the bills that will owe again; a payment matched to a
 * bank statement line is sent to Banking to unmatch first.
 * `?action=email|delete` (from a row's menu) opens that dialog.
 */
export function VendorPaymentDetail({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const showToast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [payment, setPayment] = useState<VendorPaymentDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [reconciledOpen, setReconciledOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // Whether "Email remittance advice" can be the next step: an address for the vendor, and email set up.
  const [mail, setMail] = useState<{ to: string | null; ready: boolean } | null>(null);
  const searchParams = useSearchParams();
  const action = useRef(searchParams.get("action"));
  const canEmail = useCanEditOwnership(payment?.createdByUserId ?? null, { own: "vendor_payments.edit_own", others: "vendor_payments.edit_others" });
  const canDelete = useCanEditOwnership(payment?.createdByUserId ?? null, { own: "vendor_payments.delete_own", others: "vendor_payments.delete_others" });
  const locale = orgLocaleTag();

  const load = useCallback(() => {
    apiClient
      .get<VendorPaymentDetailData>(`/vendor-payments/${paymentId}`)
      .then(setPayment)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this payment."));
  }, [paymentId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (!payment || !canEmail) return;
    apiClient
      .get<{ to: string | null; emailReady: boolean }>(`/vendor-payments/${payment.id}/remittance/draft`)
      .then((d) => setMail({ to: d.to, ready: d.emailReady }))
      .catch(() => setMail(null));
  }, [payment, canEmail]);

  const money = (v: string | bigint) => formatMoney(BigInt(v), payment?.currency ?? "USD");
  const number = payment?.number ?? "Vendor payment";
  const vendor = payment?.contactName ?? "the vendor";

  async function download() {
    if (!payment) return;
    setDownloading(true);
    setActionError(null);
    try {
      const { blob, headers } = await apiClient.download(`/vendor-payments/${payment.id}/remittance.pdf`);
      saveBlob(blob, filenameFrom(headers, `remittance-${number}.pdf`));
    } catch (err) {
      setActionError({ title: "Couldn't download the remittance advice.", message: err instanceof Error ? err.message : "Try again." });
    } finally {
      setDownloading(false);
    }
  }

  async function remove() {
    if (!payment) return;
    if (payment.reconciled) {
      setReconciledOpen(true);
      return;
    }
    const owes = payment.paidTo.map((b, i) => `${b.billNumber} ${i === 0 ? "will owe" : ""} ${money(b.amount)}${BigInt(b.billBalance) > 0n ? " more" : " again"}`.replace(/\s+/g, " "));
    const list = owes.length <= 1 ? owes[0] : `${owes.slice(0, -1).join(", ")} and ${owes.at(-1)}`;
    const ok = await confirm({
      title: `Delete ${number}?`,
      description: `It's removed for good, and a reversing entry posts today.${list ? ` ${list}.` : ""}`,
      confirmLabel: "Delete payment",
      danger: true,
    });
    if (!ok) return;
    setActionError(null);
    try {
      await apiClient.delete(`/vendor-payments/${payment.id}`);
      showToast(`${number} deleted`, payment.paidTo.length ? `The bills it paid owe again, and its entry was reversed.` : "Its entry was reversed.");
      router.push("/vendor-payments");
    } catch (err) {
      setActionError({ title: `Couldn't delete ${number}.`, message: err instanceof Error ? err.message : "Try again." });
    }
  }

  // A row's menu opens the page with ?action= — once, then the address is cleaned.
  useEffect(() => {
    const next = action.current;
    if (!payment || !next) return;
    action.current = null;
    router.replace(`/vendor-payments/${payment.id}`, { scroll: false });
    if (next === "email" && canEmail) setEmailOpen(true);
    else if (next === "delete" && canDelete) void remove();
    // Runs once, when the payment first loads.
  }, [payment]);

  if (error && !payment) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!payment) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const today = new Date();
  const method = PAYMENT_METHOD_LABELS[payment.method];
  const date = calendarDate(payment.date.slice(0, 10), today, locale);
  const emailIsNext = canEmail && mail !== null && mail.ready && Boolean(mail.to) && payment.paidTo.length > 0;
  const emailWhyNot = !mail ? null : !mail.ready ? "Set up email sending first" : !mail.to ? `Add an email address for ${vendor}` : null;
  const full = payment.paidTo.filter((b) => BigInt(b.billBalance) === 0n);
  const part = payment.paidTo.filter((b) => BigInt(b.billBalance) > 0n);
  const billsSub = [full.length ? `${full.map((b) => b.billNumber).join(", ")} in full` : null, part.length ? `part of ${part.map((b) => b.billNumber).join(", ")}` : null].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Purchases" }, { label: "Vendor payments", href: "/vendor-payments" }, { label: number }]} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-[18rem] flex-1 flex-col gap-1">
            <h1 className="text-[24px] font-bold leading-tight tracking-tight text-on-surface">{number}</h1>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-on-surface-muted" data-testid="vendor-payment-meta">
              <span className="inline-flex items-center gap-1.5">
                <Building2 size={14} aria-hidden />
                <Link href={`/contacts/${payment.contactId}`} className="font-medium text-primary hover:underline">
                  {payment.contactName ?? "Unknown vendor"}
                </Link>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden />
                {date}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ArrowRightLeft size={14} aria-hidden />
                {method}
              </span>
              {payment.moneyAccount && (
                <span className="inline-flex items-center gap-1.5">
                  <Landmark size={14} aria-hidden />
                  Paid from {payment.moneyAccount.name}
                </span>
              )}
              {payment.reference && (
                <span className="inline-flex items-center gap-1.5">
                  <Hash size={14} aria-hidden />
                  {payment.reference}
                </span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2" data-testid="vendor-payment-actions">
            <Button variant={emailIsNext ? "secondary" : "primary"} onClick={() => void download()} disabled={downloading}>
              {downloading ? <Spinner size="sm" /> : <Download size={14} aria-hidden />}
              Download remittance advice
            </Button>
            {emailIsNext && (
              <Button onClick={() => setEmailOpen(true)}>
                <Mail size={14} aria-hidden />
                Email remittance advice
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  More <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEmail && !emailIsNext && (
                  <DropdownMenuItem disabled={Boolean(emailWhyNot) || payment.paidTo.length === 0} onSelect={() => setEmailOpen(true)}>
                    <MENU_ICONS.email aria-hidden />
                    <span className="flex flex-col">
                      Email remittance advice
                      {emailWhyNot && <span className="text-[11.5px]">{emailWhyNot}</span>}
                    </span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                  <MENU_ICONS.history aria-hidden />
                  View history
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => void remove()}>
                      <MENU_ICONS.delete aria-hidden />
                      Delete payment
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <HistorySection endpoint={`/vendor-payments/${payment.id}/history`} subjectLabel="this vendor payment" open={historyOpen} onOpenChange={setHistoryOpen} />
          </div>
        </div>
      </div>

      {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}

      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-surface sm:grid-cols-2" data-testid="vendor-payment-figures">
        <div className="flex flex-col gap-0.5 px-4 py-3">
          <span className="text-[12px] text-on-surface-muted">Paid</span>
          <span className="text-[20px] font-semibold tabular-nums text-on-surface">{money(payment.amount)}</span>
          <span className="text-[12px] text-on-surface-muted">
            {method} · {date}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 border-t border-border px-4 py-3 sm:border-l sm:border-t-0">
          <span className="text-[12px] text-on-surface-muted">Bills paid</span>
          <span className="text-[20px] font-semibold text-on-surface">{payment.paidTo.length === 1 ? payment.paidTo[0]!.billNumber : `${payment.paidTo.length} bills`}</span>
          <span className="text-[12px] text-on-surface-muted">{billsSub || "—"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="p-0" data-testid="vendor-payment-paid-to">
            <h3 className="px-4 pb-2 pt-4 text-[14px] font-semibold text-on-surface">Paid to</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead className="bg-surface-sunken text-[12px] text-on-surface-muted">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Bill</th>
                    <th className="px-4 py-2 text-right font-medium">Bill total</th>
                    <th className="px-4 py-2 text-right font-medium">From this payment</th>
                    <th className="px-4 py-2 text-right font-medium">Still owes</th>
                    <th className="px-4 py-2 text-right font-medium">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {payment.paidTo.map((b) => (
                    <tr key={b.allocationId} className="border-t border-border" data-testid="paid-to-row">
                      <td className="px-4 py-2.5">
                        <Link href={`/vendor-bills/${b.billId}`} className="font-medium text-primary hover:underline">
                          {b.billNumber}
                        </Link>
                        {b.billDate && <span className="block text-[12px] text-on-surface-muted">Billed {calendarDate(b.billDate, today, locale)}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(b.billTotal)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(b.amount)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{BigInt(b.billBalance) > 0n ? money(b.billBalance) : <span className="font-medium text-paid">Paid</span>}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">{b.dueDate ? calendarDate(b.dueDate, today, locale) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <AttachmentsSection entityType="vendor_payment" entityId={payment.id} />
          {payment.notes && (
            <Card className="p-0">
              <h3 className="px-4 pb-1 pt-4 text-[14px] font-semibold text-on-surface">Notes</h3>
              <p className="px-4 pb-4 text-[13.5px] text-on-surface">{payment.notes}</p>
            </Card>
          )}
        </div>
        <VendorPaymentActivity paymentId={payment.id} currency={payment.currency} refreshKey={refreshKey} onViewHistory={() => setHistoryOpen(true)} />
      </div>

      <RemittanceEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        paymentId={payment.id}
        number={number}
        vendorName={vendor}
        onSent={(to) => {
          showToast("Remittance advice sent", `${number}'s remittance advice went to ${to}.`);
          setRefreshKey((k) => k + 1);
        }}
      />
      <Dialog open={reconciledOpen} onOpenChange={setReconciledOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Can&apos;t delete {number} yet</DialogTitle>
            <DialogDescription>
              {number} is matched to a bank statement line{payment.moneyAccount ? ` in ${payment.moneyAccount.name}` : ""}. Unmatch it in Banking first, then delete it — so your reconciled figures don&apos;t change.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setReconciledOpen(false)}>
              Close
            </Button>
            {payment.moneyAccountId && (
              <Button onClick={() => router.push(`/banking/${payment.moneyAccountId}`)}>
                <Landmark size={14} aria-hidden />
                Open {payment.moneyAccount?.name ?? "the account"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
