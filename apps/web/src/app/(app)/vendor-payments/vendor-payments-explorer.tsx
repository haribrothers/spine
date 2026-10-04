"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, Combobox, EmptyState, StatCard } from "@spine/ui";
import { HandCoins } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { useEntityToast } from "./entity-toast";
import { NewVendorPaymentDialog } from "./new-vendor-payment-dialog";
import { VendorPaymentDetailDrawer } from "./vendor-payment-detail-drawer";
import { VendorPaymentsSkeleton } from "./vendor-payments-skeleton";
import { VendorPaymentsTable } from "./vendor-payments-table";
import type { ContactOption, VendorPayment } from "./types";
import { useVendorPaymentStats } from "./use-vendor-payment-stats";
import { formatMoney } from "../../../lib/money";

const ALL_CONTACTS = "__all__";

/**
 * The Vendor Payments list page's client-side body — a stat-card row, a
 * contact filter, and one table, mirroring payments/payments-explorer.tsx's
 * exact structure minus the "Unallocated credit" stat card (no such concept
 * on the vendor side — see types.ts's own doc comment).
 */
export function VendorPaymentsExplorer() {
  const canCreate = useCapability("vendor_payments.edit_own");
  const [payments, setPayments] = useState<VendorPayment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contactFilter, setContactFilter] = useState<string>(ALL_CONTACTS);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [newPaymentOpen, setNewPaymentOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const { show: showToast, toast } = useEntityToast();

  const stats = useVendorPaymentStats(payments);

  const loadPayments = useCallback(() => {
    const query = contactFilter !== ALL_CONTACTS ? `?contactId=${contactFilter}` : "";
    apiClient
      .get<VendorPayment[]>(`/vendor-payments${query}`)
      .then(setPayments)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load vendor payments."));
  }, [contactFilter]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    apiClient
      .get<ContactOption[]>("/contacts?type=vendor&type=both")
      .then(setContacts)
      .catch(() => {});
  }, []);

  const contactOptions = useMemo(
    () => [
      { value: ALL_CONTACTS, label: "All vendors" },
      ...contacts.filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name })),
    ],
    [contacts],
  );

  function handleRecorded() {
    loadPayments();
    showToast("Payment recorded", "The payment has been saved and posted to the ledger.");
  }

  function handleDeleted(payment: VendorPayment) {
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Total payments" value={stats.total === null ? "—" : String(stats.total)} />
        <StatCard
          label="Total paid"
          value={
            stats.totalAmount === null
              ? stats.hasMixedCurrencies
                ? "Mixed currencies"
                : "—"
              : `${formatMoney(stats.totalAmount, stats.currency ?? "USD")} ${stats.currency ?? ""}`
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Combobox
          options={contactOptions}
          value={contactFilter}
          onValueChange={setContactFilter}
          placeholder="All vendors"
          className="w-48"
        />
        {canCreate && <Button onClick={() => setNewPaymentOpen(true)}>Record payment</Button>}
      </div>

      {!payments ? (
        <VendorPaymentsSkeleton />
      ) : payments.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          {contactFilter !== ALL_CONTACTS ? (
            <EmptyState
              icon={<HandCoins />}
              title="No payments for this vendor"
              description="Try clearing the vendor filter."
              action={
                <Button variant="secondary" onClick={() => setContactFilter(ALL_CONTACTS)}>
                  Clear filter
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<HandCoins />}
              title="No vendor payments recorded yet"
              description="Record a payment against one or more of a vendor's recorded bills."
              action={canCreate ? <Button onClick={() => setNewPaymentOpen(true)}>Record payment</Button> : undefined}
            />
          )}
        </div>
      ) : (
        <VendorPaymentsTable payments={payments} onOpen={(payment) => setSelectedPaymentId(payment.id)} />
      )}

      <NewVendorPaymentDialog open={newPaymentOpen} onOpenChange={setNewPaymentOpen} onRecorded={handleRecorded} />
      <VendorPaymentDetailDrawer
        open={selectedPaymentId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPaymentId(null);
        }}
        paymentId={selectedPaymentId}
        onDeleted={handleDeleted}
      />
      {toast}
    </div>
  );
}
