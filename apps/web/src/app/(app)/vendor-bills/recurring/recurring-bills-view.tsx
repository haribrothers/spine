"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AppShellHeader, Badge, Button, EmptyState, Table, TableSkeleton, type TableColumn } from "@spine/ui";
import { describeRepeats, RECURRING_BILL_MODE_OPTIONS, RECURRING_STATUS_LABELS, type RecurringBill, type RecurringStatus } from "@spine/shared";
import { Repeat } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import { useCapability } from "../../../../lib/capabilities-context";
import { formatMoney } from "../../../../lib/money";
import { useEntityToast } from "../entity-toast";
import { formatRunDate } from "../../invoices/recurring/recurring-invoices-view";
import { RecurringBillDialog } from "./recurring-bill-dialog";

const STATUS_BADGE_CLASS: Record<RecurringStatus, string> = {
  active: "bg-paid-bg text-paid",
  paused: "bg-due-soon-bg text-due-soon",
  finished: "bg-draft-bg text-draft",
};

/**
 * US-PUR-29–31 (D-159) — `RecurringBillsList`: each schedule's name, vendor,
 * frequency, next date, amount and status, and "+ New recurring bill".
 * Needs `vendor_bills.manage_recurring`, like every `/recurring-bills` route.
 */
export function RecurringBillsView() {
  const canManage = useCapability("vendor_bills.manage_recurring");
  const [schedules, setSchedules] = useState<RecurringBill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RecurringBill | null>(null);
  const { show: showToast, toast } = useEntityToast();

  const load = useCallback(() => {
    apiClient
      .get<RecurringBill[]>("/recurring-bills")
      .then(setSchedules)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load recurring bills."));
  }, []);

  useEffect(() => {
    if (canManage) load();
  }, [canManage, load]);

  const header = (
    <AppShellHeader
      breadcrumb={[{ label: "Vendor Bills", href: "/vendor-bills" }, { label: "Recurring" }]}
      title="Recurring bills"
      description="Bills Spine enters for you on a schedule — rent, subscriptions and retainers."
      action={canManage ? <Button onClick={() => setCreating(true)}>+ New recurring bill</Button> : undefined}
    />
  );

  if (!canManage || error) {
    return (
      <>
        {header}
        <Alert variant="critical">
          <AlertDescription>{error ?? "You don't have access to recurring bills. Ask an Owner to grant “Manage recurring bills” to your Team."}</AlertDescription>
        </Alert>
      </>
    );
  }

  const columns: TableColumn<RecurringBill>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <button type="button" onClick={() => setEditing(row)} className="text-left font-medium text-on-surface hover:text-primary hover:underline">
          {row.name}
        </button>
      ),
      sortValue: (row) => row.name,
    },
    { key: "vendor", header: "Vendor", render: (row) => row.contactName, sortValue: (row) => row.contactName },
    { key: "repeats", header: "Repeats", render: (row) => describeRepeats(row.frequency, row.dayRule) },
    { key: "next", header: "Next bill", render: (row) => (row.status === "active" ? formatRunDate(row.nextRunOn) : "—"), sortValue: (row) => row.nextRunOn ?? "" },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => <span className="tabular-nums">{formatMoney(BigInt(row.totalAmount), row.currency)}</span>,
      sortValue: (row) => BigInt(row.totalAmount),
    },
    { key: "status", header: "Status", render: (row) => <Badge className={STATUS_BADGE_CLASS[row.status]}>{RECURRING_STATUS_LABELS[row.status]}</Badge> },
    { key: "mode", header: "When it runs", render: (row) => RECURRING_BILL_MODE_OPTIONS.find((o) => o.value === row.mode)?.short ?? row.mode },
  ];

  return (
    <>
      {header}
      <div className="flex flex-col gap-4">
        {!schedules ? (
          <TableSkeleton columns={columns} rows={3} />
        ) : schedules.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState icon={<Repeat />} title="No recurring bills yet" description="Set one up for rent or a subscription, and Spine enters the bill on its day." />
          </div>
        ) : (
          <div data-testid="recurring-bills-table">
            <Table columns={columns} data={schedules} rowKey={(row) => row.id} />
          </div>
        )}
        <p className="text-[13px] text-on-surface-muted">
          Runs happen at 6:00 AM organisation time. If Spine was off on a run date, each missed bill is created once, in order, when it starts again.
        </p>
        <RecurringBillDialog
          open={creating || !!editing}
          onOpenChange={(open) => {
            if (open) return;
            setCreating(false);
            setEditing(null);
          }}
          schedule={editing}
          onSaved={(saved) => {
            const wasEditing = !!editing;
            setCreating(false);
            setEditing(null);
            load();
            showToast(
              "Schedule saved",
              wasEditing ? `${saved.name} is updated. Bills it already created stay as they are.` : `${saved.name} is active. The first bill is on ${formatRunDate(saved.nextRunOn)}.`,
            );
          }}
        />
        {toast}
      </div>
    </>
  );
}
