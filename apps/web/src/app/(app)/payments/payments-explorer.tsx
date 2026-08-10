"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, Combobox, EmptyState, StatCard } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import { Banknote } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useEntityToast } from "./entity-toast";
import { NewPaymentDialog } from "./new-payment-dialog";
import { PaymentDetailDrawer } from "./payment-detail-drawer";
import { PaymentsSkeleton } from "./payments-skeleton";
import { PaymentsTable } from "./payments-table";
import type { ContactOption, Payment } from "./types";
import { usePaymentStats } from "./use-payment-stats";

const ALL_CONTACTS = "__all__";

/**
 * The Payments list page's client-side body — S-06.1–S-06.5's standalone
 * home, alongside the invoice-triggered `record-payment-dialog.tsx`. A
 * stat-card row, a contact filter, and one table, mirroring
 * invoices/invoices-explorer.tsx's structure — minus a status filter,
 * since a payment has no status enum to filter on (see payments.ts's own
 * schema comment: no draft state, just recorded-or-not).
 */
export function PaymentsExplorer() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contactFilter, setContactFilter] = useState<string>(ALL_CONTACTS);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [newPaymentOpen, setNewPaymentOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const { show: showToast, toast } = useEntityToast();

  const stats = usePaymentStats(payments);

  const loadPayments = useCallback(() => {
    const query = contactFilter !== ALL_CONTACTS ? `?contactId=${contactFilter}` : "";
    apiClient
      .get<Payment[]>(`/payments${query}`)
      .then(setPayments)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load payments."));
  }, [contactFilter]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    apiClient
      .get<ContactOption[]>("/contacts")
      .then(setContacts)
      .catch(() => {});
  }, []);

  const contactOptions = useMemo(
    () => [
      { value: ALL_CONTACTS, label: "All contacts" },
      ...contacts.filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name })),
    ],
    [contacts],
  );

  function handleRecorded() {
    loadPayments();
    showToast("Payment recorded", "The payment has been saved and posted to the ledger.");
  }

  function handleDeleted(payment: Payment) {
    loadPayments();
    showToast("Payment deleted", `${payment.number ?? "This payment"} has been permanently removed.`);
  }

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total payments" value={stats.total === null ? "—" : String(stats.total)} />
        <StatCard
          label="Unallocated credit"
          value={
            stats.unallocatedTotal === null
              ? stats.hasMixedCurrencies
                ? "Mixed currencies"
                : "—"
              : `${toDecimalString({ amount: stats.unallocatedTotal, currency: stats.currency ?? "USD" })} ${stats.currency ?? ""}`
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Combobox
          options={contactOptions}
          value={contactFilter}
          onValueChange={setContactFilter}
          placeholder="All contacts"
          className="w-48"
        />
        <Button onClick={() => setNewPaymentOpen(true)}>Record payment</Button>
      </div>

      {!payments ? (
        <PaymentsSkeleton />
      ) : payments.length === 0 ? (
        <div className="rounded-lg border border-border">
          {contactFilter !== ALL_CONTACTS ? (
            <EmptyState
              icon={<Banknote />}
              title="No payments for this contact"
              description="Try clearing the contact filter."
              action={
                <Button variant="secondary" onClick={() => setContactFilter(ALL_CONTACTS)}>
                  Clear filter
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Banknote />}
              title="No payments recorded yet"
              description="Record a payment against one or more invoices, or hold it as unallocated customer credit."
              action={<Button onClick={() => setNewPaymentOpen(true)}>Record payment</Button>}
            />
          )}
        </div>
      ) : (
        <PaymentsTable payments={payments} onOpen={(payment) => setSelectedPaymentId(payment.id)} />
      )}

      <NewPaymentDialog open={newPaymentOpen} onOpenChange={setNewPaymentOpen} onRecorded={handleRecorded} />
      <PaymentDetailDrawer
        open={selectedPaymentId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPaymentId(null);
        }}
        paymentId={selectedPaymentId}
        onDeleted={handleDeleted}
        onChanged={loadPayments}
      />
      {toast}
    </div>
  );
}
