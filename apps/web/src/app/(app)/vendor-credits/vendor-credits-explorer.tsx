"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileMinus } from "lucide-react";
import { Alert, AlertDescription, Button, Combobox, DataTable, EmptyState, StatCard, TableSkeleton, type TableColumn } from "@spine/ui";
import { VENDOR_CREDIT_STATUS_LABELS, type VendorCreditStatus } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import type { VendorCredit } from "./types";
import { VendorCreditStatusChip } from "./vendor-credit-detail";

const ALL = "__all__";
const TABLE_COLUMNS = [
  { key: "number", header: "Number", width: "w-24" },
  { key: "ref", header: "Vendor's number", width: "w-24" },
  { key: "vendor", header: "Vendor", width: "w-40" },
  { key: "amount", header: "Amount", width: "w-24" },
];

/** US-PUR-24 — `VendorCreditsList`: every vendor credit with its status and what's left to use. */
export function VendorCreditsExplorer() {
  const canCreate = useCapability("vendor_credits.edit_own");
  const [credits, setCredits] = useState<VendorCredit[] | null>(null);
  const [status, setStatus] = useState(ALL);
  const [vendor, setVendor] = useState(ALL);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<VendorCredit[]>("/vendor-credits")
      .then(setCredits)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load vendor credits."));
  }, []);

  const vendors = useMemo(() => {
    const byId = new Map((credits ?? []).map((c) => [c.contactId, c.contactName ?? ""]));
    return [{ value: ALL, label: "All vendors" }, ...[...byId.entries()].map(([value, label]) => ({ value, label }))];
  }, [credits]);
  const shown = (credits ?? []).filter((c) => (status === ALL || c.status === status) && (vendor === ALL || c.contactId === vendor));
  const count = (s: VendorCreditStatus) => (credits ?? []).filter((c) => c.status === s);
  const currency = credits?.[0]?.currency ?? "USD";
  const openTotal = count("open").reduce((sum, c) => sum + BigInt(c.balanceAmount), 0n);

  const columns: TableColumn<VendorCredit>[] = [
    {
      key: "number",
      header: "Number",
      render: (row) => (
        <Link href={`/vendor-credits/${row.id}`} className="font-medium text-on-surface hover:text-primary hover:underline">
          {row.number ?? <span className="italic text-on-surface-muted">— (unrecorded draft)</span>}
        </Link>
      ),
      sortValue: (row) => row.number ?? "",
    },
    { key: "ref", header: "Vendor's number", render: (row) => row.vendorReference ?? "—" },
    { key: "vendor", header: "Vendor", render: (row) => row.contactName ?? "—", sortValue: (row) => row.contactName ?? "" },
    { key: "status", header: "Status", render: (row) => <VendorCreditStatusChip status={row.status} /> },
    { key: "date", header: "Date", render: (row) => new Date(`${row.date.slice(0, 10)}T00:00:00`).toLocaleDateString(), sortValue: (row) => row.date },
    { key: "amount", header: "Amount", align: "right", render: (row) => <span className="tabular-nums">{formatMoney(BigInt(row.totalAmount), row.currency)}</span>, sortValue: (row) => Number(row.totalAmount) },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      render: (row) => <span className="tabular-nums">{formatMoney(row.status === "void" ? 0n : BigInt(row.balanceAmount), row.currency)}</span>,
      sortValue: (row) => Number(row.balanceAmount),
    },
  ];

  if (error)
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total credits" value={credits ? String(credits.length) : "—"} />
        <StatCard label="Draft" value={credits ? String(count("draft").length) : "—"} />
        <StatCard label="Open" value={credits ? String(count("open").length) : "—"} trend={credits ? { direction: "neutral", label: `${formatMoney(openTotal, currency)} to use` } : undefined} />
        <StatCard label="Used" value={credits ? String(count("used").length) : "—"} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <Combobox
            aria-label="Status"
            className="w-40"
            options={[{ value: ALL, label: "All statuses" }, ...Object.entries(VENDOR_CREDIT_STATUS_LABELS).map(([value, label]) => ({ value, label }))]}
            value={status}
            onValueChange={setStatus}
          />
          <Combobox aria-label="Vendor" className="w-48" options={vendors} value={vendor} onValueChange={setVendor} />
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/vendor-credits/new">New vendor credit</Link>
          </Button>
        )}
      </div>
      {!credits ? (
        <TableSkeleton columns={TABLE_COLUMNS} />
      ) : credits.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<FileMinus />} title="No vendor credits yet" description="Record a vendor's credit note for returned goods, an overcharge or a discount after the bill." />
        </div>
      ) : (
        <div data-testid="vendor-credits-table">
          <DataTable columns={columns} data={shown} rowKey={(row) => row.id} searchPlaceholder="Search vendor credits" searchKey={(row) => `${row.number ?? ""} ${row.vendorReference ?? ""} ${row.contactName ?? ""}`} configurablePageSize />
        </div>
      )}
    </div>
  );
}
