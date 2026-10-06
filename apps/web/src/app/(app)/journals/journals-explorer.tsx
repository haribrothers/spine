"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShellHeader, Button, StatusChip } from "@spine/ui";
import type { ManualJournal } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useMyRole } from "../../../lib/role-context";
import { formatMoney } from "../../../lib/money";
import { JournalDialog } from "./journal-dialog";

const day = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** US-RPT-20 — Reports › Journals: every manual journal, newest first, and "New journal" for an Owner. */
export function JournalsExplorer() {
  const router = useRouter();
  const isOwner = useMyRole() === "owner";
  const [rows, setRows] = useState<ManualJournal[] | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(() => {
    apiClient.get<ManualJournal[]>("/manual-journals").then(setRows).catch(() => setRows([]));
  }, []);

  useEffect(() => {
    load();
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
  }, [load]);

  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Reports" }, { label: "Journals" }]}
        title="Journals"
        description="Adjustments posted by hand. Most businesses only need one for year-end adjustments."
        action={isOwner ? <Button onClick={() => setNewOpen(true)}>New journal</Button> : undefined}
      />
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-[14px]" data-testid="journals-table">
          <thead>
            <tr className="border-b border-border text-left text-on-surface-muted">
              <th className="px-4 py-3 font-medium">Number</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Posted by</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((j) => (
              <tr key={j.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/journals/${j.id}`} className="font-medium text-on-surface hover:text-primary hover:underline">
                    {j.number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-on-surface">{day(j.date)}</td>
                <td className="px-4 py-3 text-on-surface">{j.reason}</td>
                <td className="px-4 py-3">{j.status === "reversed" ? <StatusChip status="draft">Reversed</StatusChip> : <StatusChip status="paid">Posted</StatusChip>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(BigInt(j.total), currency)}</td>
                <td className="px-4 py-3 text-on-surface">{j.postedBy?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <JournalDialog open={newOpen} onOpenChange={setNewOpen} currency={currency} onPosted={(j) => router.push(`/journals/${j.id}`)} />
    </>
  );
}
