"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AppShellHeader, Badge, Button, EmptyState, Table, TableSkeleton, type TableColumn } from "@spine/ui";
import { describeRepeats, RECURRING_BILL_MODE_OPTIONS, RECURRING_STATUS_LABELS, type RecurringBill, type RecurringStatus } from "@spine/shared";
import { Repeat } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import { useCapability } from "../../../../lib/capabilities-context";
import { formatMoney } from "../../../../lib/money";
import { useToast } from "../../../../components/toast-host";
import { formatRunDate } from "../../invoices/recurring/recurring-invoices-view";
import { RecurringBillDialog } from "./recurring-bill-dialog";
import { RecurringRowActions } from "../../invoices/recurring/recurring-row-actions";
import { ActionError } from "../../../../components/action-error";
import { useT } from "../../../../lib/i18n";

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
  const t = useT();
  const canManage = useCapability("vendor_bills.manage_recurring");
  const [schedules, setSchedules] = useState<RecurringBill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RecurringBill | null>(null);
  const showToast = useToast();

  const load = useCallback(() => {
    apiClient
      .get<RecurringBill[]>("/recurring-bills")
      .then(setSchedules)
      .catch((err) => setError(err instanceof Error ? err.message : t("vendorBills.recurring.loadFailed")));
  }, []);

  useEffect(() => {
    if (canManage) load();
  }, [canManage, load]);

  const header = (
    <AppShellHeader
      breadcrumb={[{ label: t("vendorBills.recurring.breadcrumbVendorBills"), href: "/vendor-bills" }, { label: t("vendorBills.recurring.breadcrumbRecurring") }]}
      title={t("vendorBills.recurring.title")}
      description={t("vendorBills.recurring.description")}
      action={canManage ? <Button onClick={() => setCreating(true)}>{t("vendorBills.recurring.newButton")}</Button> : undefined}
    />
  );

  if (!canManage || error) {
    return (
      <>
        {header}
        <Alert variant="critical">
          <AlertDescription>{error ?? t("vendorBills.recurring.noAccess")}</AlertDescription>
        </Alert>
      </>
    );
  }

  const columns: TableColumn<RecurringBill>[] = [
    {
      key: "name",
      header: t("vendorBills.recurring.name"),
      render: (row) => (
        <button type="button" onClick={() => setEditing(row)} className="text-left font-medium text-on-surface hover:text-primary hover:underline">
          {row.name}
        </button>
      ),
      // US-OPS-56: on a phone, the name on one line; tapping the row edits it, as the name does.
      phone: "title",
      phoneRender: (row) => (
        <button type="button" onClick={() => setEditing(row)} className="max-w-full truncate text-left">
          {row.name}
        </button>
      ),
      sortValue: (row) => row.name,
    },
    {
      key: "vendor",
      phone: "subtitle",
      phoneRender: (row) => [row.contactName, describeRepeats(row.frequency, row.dayRule)].filter(Boolean).join(" · "),
      header: t("vendorBills.recurring.vendor"), render: (row) => row.contactName,
      sortValue: (row) => row.contactName,
    },
    { key: "repeats", phone: "hidden", header: t("vendorBills.recurring.repeats"), render: (row) => describeRepeats(row.frequency, row.dayRule) },
    {
      key: "next",
      phone: "trailingSub",
      phoneRender: (row) => (row.status === "active" ? formatRunDate(row.nextRunOn) : null),
      header: t("vendorBills.recurring.nextBill"), render: (row) => (row.status === "active" ? formatRunDate(row.nextRunOn) : "—"),
      sortValue: (row) => row.nextRunOn ?? "",
    },
    {
      key: "amount",
      phone: "trailing",
      header: t("vendorBills.recurring.amount"),
      align: "right",
      render: (row) => <span className="tabular-nums">{formatMoney(BigInt(row.totalAmount), row.currency)}</span>,
      sortValue: (row) => BigInt(row.totalAmount),
    },
    { key: "status", phone: "badge", header: t("vendorBills.recurring.status"), render: (row) => <Badge className={STATUS_BADGE_CLASS[row.status]}>{RECURRING_STATUS_LABELS[row.status]}</Badge> },
    { key: "mode", phone: "hidden", header: t("vendorBills.recurring.whenItRuns"), render: (row) => RECURRING_BILL_MODE_OPTIONS.find((o) => o.value === row.mode)?.short ?? row.mode },
    {
      key: "actions",
      phone: "action",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          {/* US-PUR-31 — Edit, Pause or Resume, Delete. */}
          <RecurringRowActions
            schedule={row}
            endpoint="/recurring-bills"
            keptText={t("vendorBills.recurring.keptText")}
            onEdit={setEditing}
            onChanged={(saved, action) => {
              setActionError(null);
              load();
              showToast(
                action === "paused" ? t("vendorBills.recurring.paused") : t("vendorBills.recurring.resumed"),
                action === "paused"
                  ? t("vendorBills.recurring.pausedDescription", { name: saved.name })
                  : saved.nextRunOn
                    ? t("vendorBills.recurring.nextBillOn", { name: saved.name, date: formatRunDate(saved.nextRunOn) })
                    : t("vendorBills.recurring.reachedEnd", { name: saved.name }),
              );
            }}
            onDeleted={(deleted) => {
              setActionError(null);
              load();
              showToast(t("vendorBills.recurring.deleted"), t("vendorBills.recurring.deletedDescription", { name: deleted.name }));
            }}
            onError={(message) => setActionError({ title: t("vendorBills.recurring.changeFailed"), message })}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      {header}
      <div className="flex flex-col gap-4">
        {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
        {!schedules ? (
          <TableSkeleton columns={columns} rows={3} />
        ) : schedules.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState icon={<Repeat />} title={t("vendorBills.recurring.emptyTitle")} description={t("vendorBills.recurring.emptyDescription")} />
          </div>
        ) : (
          <div data-testid="recurring-bills-table">
            <Table columns={columns} data={schedules} rowKey={(row) => row.id} />
          </div>
        )}
        <p className="text-[13px] text-on-surface-muted">
          {t("vendorBills.recurring.runsNote")}
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
              t("vendorBills.recurring.saved"),
              wasEditing ? t("vendorBills.recurring.updatedDescription", { name: saved.name }) : t("vendorBills.recurring.activeDescription", { name: saved.name, date: formatRunDate(saved.nextRunOn) }),
            );
          }}
        />
      </div>
    </>
  );
}
