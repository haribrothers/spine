"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AppShellHeader, Badge, Button, EmptyState, Table, TableSkeleton, type TableColumn } from "@spine/ui";
import { describeRepeats, RECURRING_MODE_OPTIONS, RECURRING_STATUS_LABELS, type RecurringInvoice, type RecurringStatus } from "@spine/shared";
import { Repeat } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import { useCapability } from "../../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../../lib/money";
import { useToast } from "../../../../components/toast-host";
import { RecurringInvoiceDialog } from "./recurring-invoice-dialog";
import { RecurringRowActions } from "./recurring-row-actions";
import { ActionError } from "../../../../components/action-error";
import { useT } from "../../../../lib/i18n";

const STATUS_BADGE_CLASS: Record<RecurringStatus, string> = {
  active: "bg-paid-bg text-paid",
  paused: "bg-due-soon-bg text-due-soon",
  finished: "bg-draft-bg text-draft",
};

/** "Nov 1, 2026" for a `YYYY-MM-DD` calendar date. */
export function formatRunDate(value: string | null): string {
  if (!value) return "—";
  return new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))).toLocaleDateString(orgLocaleTag(), {
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
  const t = useT();
  const canManage = useCapability("invoices.manage_recurring");
  const [schedules, setSchedules] = useState<RecurringInvoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RecurringInvoice | null>(null);
  const showToast = useToast();

  const load = useCallback(() => {
    apiClient
      .get<RecurringInvoice[]>("/recurring-invoices")
      .then(setSchedules)
      .catch((err) => setError(err instanceof Error ? err.message : t("invoices.recurring.loadFailed")));
  }, []);

  useEffect(() => {
    if (canManage) load();
  }, [canManage, load]);

  const header = (
    <AppShellHeader
      breadcrumb={[{ label: t("invoices.recurring.breadcrumbInvoices"), href: "/invoices" }, { label: t("invoices.recurring.breadcrumbRecurring") }]}
      title={t("invoices.recurring.title")}
      description={t("invoices.recurring.description")}
      action={canManage ? <Button onClick={() => setCreating(true)}>{t("invoices.recurring.newButton")}</Button> : undefined}
    />
  );

  if (!canManage || error) {
    return (
      <>
        {header}
        <Alert variant="critical">
          <AlertDescription>{error ?? t("invoices.recurring.noAccess")}</AlertDescription>
        </Alert>
      </>
    );
  }

  const columns: TableColumn<RecurringInvoice>[] = [
    {
      key: "name",
      header: t("invoices.recurring.colName"),
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
      key: "customer",
      phone: "subtitle",
      phoneRender: (row) => [row.contactName, describeRepeats(row.frequency, row.dayRule)].filter(Boolean).join(" · "),
      header: t("invoices.recurring.colCustomer"),
      render: (row) => row.contactName,
      sortValue: (row) => row.contactName,
    },
    {
      key: "repeats",
      phone: "hidden",
      header: t("invoices.recurring.colRepeats"),
      render: (row) => describeRepeats(row.frequency, row.dayRule),
    },
    {
      key: "next",
      phone: "trailingSub",
      phoneRender: (row) => (row.status === "active" ? formatRunDate(row.nextRunOn) : null),
      header: t("invoices.recurring.colNext"),
      render: (row) => (row.status === "active" ? formatRunDate(row.nextRunOn) : "—"),
      sortValue: (row) => row.nextRunOn ?? "",
    },
    {
      key: "amount",
      phone: "trailing",
      header: t("invoices.recurring.colAmount"),
      align: "right",
      render: (row) => <span className="tabular-nums">{formatMoney(BigInt(row.totalAmount), row.currency)}</span>,
      sortValue: (row) => BigInt(row.totalAmount),
    },
    {
      key: "status",
      phone: "badge",
      header: t("invoices.recurring.colStatus"),
      render: (row) => <Badge className={STATUS_BADGE_CLASS[row.status]}>{RECURRING_STATUS_LABELS[row.status]}</Badge>,
    },
    {
      key: "mode",
      phone: "hidden",
      header: t("invoices.recurring.colMode"),
      render: (row) => RECURRING_MODE_OPTIONS.find((o) => o.value === row.mode)?.short ?? row.mode,
    },
    {
      key: "actions",
      phone: "action",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <RecurringRowActions
            schedule={row}
            onEdit={setEditing}
            onChanged={(saved, action) => {
              setActionError(null);
              load();
              showToast(
                action === "paused" ? t("invoices.recurring.pausedTitle") : t("invoices.recurring.resumedTitle"),
                action === "paused" ? t("invoices.recurring.pausedBody", { name: saved.name }) : t("invoices.recurring.resumedBody", { name: saved.name, date: formatRunDate(saved.nextRunOn) }),
              );
            }}
            onDeleted={(deleted) => {
              setActionError(null);
              load();
              showToast(t("invoices.recurring.deletedTitle"), t("invoices.recurring.deletedBody", { name: deleted.name }));
            }}
            onError={(message) => setActionError({ title: t("invoices.recurring.changeFailedTitle"), message })}
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
            <EmptyState
              icon={<Repeat />}
              title={t("invoices.recurring.emptyTitle")}
              description={t("invoices.recurring.emptyDescription")}
            />
          </div>
        ) : (
          <Table columns={columns} data={schedules} rowKey={(row) => row.id} />
        )}
        <p className="text-[13px] text-on-surface-muted">
          {t("invoices.recurring.runNote")}
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
              t("invoices.recurring.savedTitle"),
              wasEditing
                ? t("invoices.recurring.updatedBody", { name: saved.name })
                : t("invoices.recurring.activeBody", { name: saved.name, date: formatRunDate(saved.nextRunOn) }),
            );
          }}
        />
      </div>
    </>
  );
}
