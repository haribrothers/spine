"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AppShellHeader, Badge, Button, EmptyState, Table, TableSkeleton, type TableColumn } from "@spine/ui";
import { describeRepeats, RECURRING_MODE_OPTIONS, RECURRING_STATUS_LABELS, type RecurringInvoice, type RecurringStatus } from "@spine/shared";
import { Repeat } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import { useCapability } from "../../../../lib/capabilities-context";
import { formatMoney } from "../../../../lib/money";
import { useEntityToast } from "../entity-toast";
import { RecurringInvoiceDialog } from "./recurring-invoice-dialog";
import { RecurringRowActions } from "./recurring-row-actions";

const STATUS_BADGE_CLASS: Record<RecurringStatus, string> = {
  active: "bg-paid-bg text-paid",
  paused: "bg-due-soon-bg text-due-soon",
  finished: "bg-draft-bg text-draft",
};

/** "Nov 1, 2026" for a `YYYY-MM-DD` calendar date. */
export function formatRunDate(value: string | null): string {
  if (!value) return "—";
  return new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * US-INV-20–22 (D-092) — the recurring invoices list (`RecurringInvoicesList`)
 * and "+ New recurring invoice". Needs `invoices.manage_recurring`, like
 * every `/recurring-invoices` route.
 */
export function RecurringInvoicesView() {
  const canManage = useCapability("invoices.manage_recurring");
  const [schedules, setSchedules] = useState<RecurringInvoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RecurringInvoice | null>(null);
  const { show: showToast, toast } = useEntityToast();

  const load = useCallback(() => {
    apiClient
      .get<RecurringInvoice[]>("/recurring-invoices")
      .then(setSchedules)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load recurring invoices."));
  }, []);

  useEffect(() => {
    if (canManage) load();
  }, [canManage, load]);

  const header = (
    <AppShellHeader
      breadcrumb={[{ label: "Invoices", href: "/invoices" }, { label: "Recurring" }]}
      title="Recurring invoices"
      description="Invoices Spine creates for you on a schedule — for maintenance contracts and retainers."
      action={canManage ? <Button onClick={() => setCreating(true)}>+ New recurring invoice</Button> : undefined}
    />
  );

  if (!canManage || error) {
    return (
      <>
        {header}
        <Alert variant="critical">
          <AlertDescription>{error ?? "You don't have access to recurring invoices. Ask an Owner to grant “Manage recurring invoices” to your Team."}</AlertDescription>
        </Alert>
      </>
    );
  }

  const columns: TableColumn<RecurringInvoice>[] = [
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
    {
      key: "customer",
      header: "Customer",
      render: (row) => row.contactName,
      sortValue: (row) => row.contactName,
    },
    {
      key: "repeats",
      header: "Repeats",
      render: (row) => describeRepeats(row.frequency, row.dayRule),
    },
    {
      key: "next",
      header: "Next invoice",
      render: (row) => (row.status === "active" ? formatRunDate(row.nextRunOn) : "—"),
      sortValue: (row) => row.nextRunOn ?? "",
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => <span className="tabular-nums">{formatMoney(BigInt(row.totalAmount), row.currency)}</span>,
      sortValue: (row) => BigInt(row.totalAmount),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge className={STATUS_BADGE_CLASS[row.status]}>{RECURRING_STATUS_LABELS[row.status]}</Badge>,
    },
    {
      key: "mode",
      header: "When it runs",
      render: (row) => RECURRING_MODE_OPTIONS.find((o) => o.value === row.mode)?.short ?? row.mode,
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <RecurringRowActions
            schedule={row}
            onEdit={setEditing}
            onChanged={(saved, action) => {
              load();
              showToast(
                action === "paused" ? "Schedule paused" : "Schedule resumed",
                action === "paused" ? `${saved.name} won't create invoices until you resume it.` : `${saved.name}'s next invoice is on ${formatRunDate(saved.nextRunOn)}.`,
              );
            }}
            onDeleted={(deleted) => {
              load();
              showToast("Schedule deleted", `${deleted.name} is deleted. Invoices it already created are kept.`);
            }}
            onError={(message) => showToast("Couldn't change the schedule", message)}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      {header}
      <div className="flex flex-col gap-4">
        {!schedules ? (
          <TableSkeleton columns={columns} rows={3} />
        ) : schedules.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState
              icon={<Repeat />}
              title="No recurring invoices yet"
              description="Set one up for a maintenance contract or retainer, and Spine creates the invoice on schedule."
            />
          </div>
        ) : (
          <Table columns={columns} data={schedules} rowKey={(row) => row.id} />
        )}
        <p className="text-[13px] text-on-surface-muted">
          Each run uses the schedule&apos;s lines with today&apos;s tax rates. Runs happen at 6:00 AM organisation time; a missed run (server off) catches up once when Spine
          starts.
        </p>
        <RecurringInvoiceDialog
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
              wasEditing
                ? `${saved.name} is updated. Invoices it already created stay as they are.`
                : `${saved.name} is active. The first invoice is on ${formatRunDate(saved.nextRunOn)}.`,
            );
          }}
        />
        {toast}
      </div>
    </>
  );
}
