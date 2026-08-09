"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Spinner,
} from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { SavedToast } from "../saved-toast";

/**
 * Owner-only bulk-delete of every record the onboarding "load demo data"
 * option created (contacts, catalogue items, quotes, invoices, and
 * payments tagged `isDemo: true` — see apps/api/src/modules/demo-data).
 * Behind an AlertDialog since it's destructive and irreversible, matching
 * this component's own "reach for this specifically when an action can't
 * be undone" doc comment. Real records are never touched — the API
 * filters by `isDemo`, not by any client-supplied selection.
 *
 * One edge case worth knowing (see DemoDataService.deleteAll's own doc
 * comment): a demo contact that had an issued or paid demo invoice posted
 * real, immutable ledger history against it, so that ONE contact record
 * can be left behind even after "delete all demo data" succeeds — its
 * invoice/payment rows are still fully removed. This isn't surfaced as a
 * separate warning here since it's the same behavior a real contact with
 * real ledger history already has (offer deactivation instead), and
 * `hasDemoData` deliberately doesn't key off leftover demo contacts (see
 * DemoDataService.status), so this pane still correctly reports "no demo
 * data" afterward rather than looking stuck.
 */
export function DataPane() {
  const [status, setStatus] = useState<{ hasDemoData: boolean } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<{ hasDemoData: boolean }>("/demo-data/status").then((res) => {
      if (!cancelled) setStatus(res);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiClient.delete("/demo-data");
      setStatus({ hasDemoData: false });
      setDone(true);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">Demo data</h2>
        <p className="text-[13px] text-on-surface-muted">
          Sample contacts, catalogue items, quotes, invoices, and payments loaded from onboarding, for evaluating Spine before entering
          real data.
        </p>
      </div>

      {status.hasDemoData ? (
        <div className="flex items-center justify-between rounded-md border border-border p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-on-surface">Demo data is loaded</span>
            <span className="text-[13px] text-on-surface-muted">Removing it only deletes demo records — your real data is never touched.</span>
          </div>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Delete all demo data
          </Button>
        </div>
      ) : (
        <div className="rounded-md border border-border p-4">
          <span className="text-[13px] text-on-surface-muted">No demo data is currently loaded.</span>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every sample contact, catalogue item, quote, invoice, and payment loaded during onboarding. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting…" : "Delete demo data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SavedToast open={done} onOpenChange={setDone} />
    </div>
  );
}
