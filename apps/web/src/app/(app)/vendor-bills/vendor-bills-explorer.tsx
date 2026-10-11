"use client";

import { useModule } from "../../../lib/modules-context";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, Combobox, EmptyState, MultiSelect, StatCard } from "@spine/ui";
import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { useToast } from "../../../components/toast-host";
import { VendorBillsSkeleton } from "./vendor-bills-skeleton";
import { VendorBillsTable } from "./vendor-bills-table";
import type { ContactOption, VendorBill } from "./types";
import { useVendorBillStats } from "./use-vendor-bill-stats";
import { JobFilter, JobFilterNote, useJobFilter } from "../../../components/job-filter";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "recorded", label: "Recorded" },
  { value: "void", label: "Void" },
  { value: "overdue", label: "Overdue" },
];

const ALL_CONTACTS = "__all__";

/**
 * The Vendor Bills list page's client-side body — a stat-card row, a status
 * filter, a contact filter, and one table, mirroring
 * invoices/invoices-explorer.tsx's exact structure. "Overdue" in the status
 * filter isn't a stored status (vendor bills have no "expired" concept
 * either) — it's computed client-side from `dueDate`/`status`/`balanceDue`,
 * matching use-vendor-bill-stats.ts's own reasoning for why there's no
 * server-computed `isOverdue` flag to filter on here.
 */
export function VendorBillsExplorer() {
  const canCreate = useCapability("vendor_bills.edit_own");
  const canManageRecurring = useCapability("vendor_bills.manage_recurring");
  const jobsOn = useModule("jobsField");
  const [bills, setBills] = useState<VendorBill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [contactFilter, setContactFilter] = useState<string>(ALL_CONTACTS);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const showToast = useToast();
  // US-PUR-22 — filter by job, kept in the URL.
  const job = useJobFilter();
  const canViewCosting = useCapability("reports.view_job_profitability");

  const stats = useVendorBillStats(bills);

  const loadBills = useCallback(() => {
    const params = new URLSearchParams();
    if (contactFilter !== ALL_CONTACTS) params.set("contactId", contactFilter);
    if (job.filtering) params.set("jobId", job.jobId);
    const query = params.toString() ? `?${params}` : "";
    apiClient
      .get<VendorBill[]>(`/vendor-bills${query}`)
      .then(setBills)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load vendor bills."));
  }, [contactFilter, job.filtering, job.jobId]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

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

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  function isOverdue(bill: VendorBill): boolean {
    return bill.status === "recorded" && bill.dueDate !== null && new Date(bill.dueDate) < today && BigInt(bill.balanceDue) > 0n;
  }

  const filteredBills = useMemo(() => {
    if (!bills) return null;
    if (!statusFilter.length) return bills;
    return bills.filter((b) => statusFilter.includes(b.status) || (statusFilter.includes("overdue") && isOverdue(b)));
  }, [bills, statusFilter, today]);

  function handleDeleted(bill: VendorBill) {
    loadBills();
    showToast("Vendor bill deleted", `${bill.billNumber} has been permanently removed.`);
  }

  function handleRecorded(bill: VendorBill) {
    loadBills();
    showToast(
      bill.status === "void" ? "Vendor bill voided" : "Vendor bill recorded",
      bill.status === "void"
        ? `${bill.billNumber} has been voided and a reversing entry posted.`
        : `${bill.billNumber} has been recorded and posted to the ledger.`,
    );
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total bills" value={stats.total === null ? "—" : String(stats.total)} />
        <StatCard label="Draft" value={stats.draft === null ? "—" : String(stats.draft)} />
        <StatCard label="Recorded" value={stats.recorded === null ? "—" : String(stats.recorded)} />
        <StatCard label="Overdue" value={stats.overdue === null ? "—" : String(stats.overdue)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect
            options={STATUS_OPTIONS}
            value={statusFilter}
            onValueChange={setStatusFilter}
            placeholder="Status"
            aria-label="Filter by status"
            className="w-40"
          />
          <Combobox
            options={contactOptions}
            value={contactFilter}
            onValueChange={setContactFilter}
            placeholder="All vendors"
            className="w-48"
          />
          {/* US-SET-24 */}
          {jobsOn && <JobFilter value={job.jobId} options={job.options} onValueChange={job.setJobId} />}
        </div>
        <div className="flex items-center gap-2">
          {/* US-PUR-29 — hidden without vendor_bills.manage_recurring, which every /recurring-bills route also checks. */}
          {canManageRecurring && (
            <Button asChild variant="secondary">
              <Link href="/vendor-bills/recurring">Recurring bills</Link>
            </Button>
          )}
          {canCreate && (
            <Button asChild>
              <Link href="/vendor-bills/new">New vendor bill</Link>
            </Button>
          )}
        </div>
      </div>

      {job.filtering && job.selectedLabel && <JobFilterNote kind="vendor bills" jobId={job.jobId} label={job.selectedLabel} canViewCosting={canViewCosting} />}

      {!filteredBills ? (
        <VendorBillsSkeleton />
      ) : filteredBills.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          {job.filtering && !statusFilter.length && contactFilter === ALL_CONTACTS ? (
            <EmptyState
              icon={<ClipboardList />}
              title="No vendor bills on this job"
              description="Bills tagged to this job show up here."
              action={
                <Button variant="secondary" onClick={() => job.setJobId("__all__")}>
                  Clear filter
                </Button>
              }
            />
          ) : statusFilter.length || contactFilter !== ALL_CONTACTS || job.filtering ? (
            <EmptyState
              icon={<ClipboardList />}
              title="No vendor bills match these filters"
              description="Try adjusting or clearing the filters above."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStatusFilter([]);
                    setContactFilter(ALL_CONTACTS);
                    job.setJobId("__all__");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<ClipboardList />}
              title="No vendor bills yet"
              description="Record a bill from a vendor — save it as a draft, then record it when it's ready to post to the ledger."
              action={
                canCreate ? (
                  <Button asChild>
                    <Link href="/vendor-bills/new">New vendor bill</Link>
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      ) : (
        <VendorBillsTable bills={filteredBills} onDeleted={handleDeleted} onRecorded={handleRecorded} />
      )}
    </div>
  );
}
