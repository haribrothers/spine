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
 * Owner-only Settings › Data. "Delete all demo data" removes every row
 * tagged `isDemo`, the journal entries they posted and the demo number
 * series (US-ONB-17, D-191); the API picks the rows, never the client. A
 * demo contact that one of the person's own records uses is kept, and the
 * pane says so.
 */
export function DataPane() {
  const [status, setStatus] = useState<{ hasDemoData: boolean } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(false);
  const [keptContacts, setKeptContacts] = useState(0);

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
      const result = await apiClient.delete<{ kept?: { contacts: number } }>("/demo-data");
      setKeptContacts(result?.kept?.contacts ?? 0);
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
          A sample business to explore Spine before you enter your own. Deleting it removes every demo record, its document numbers and its
          entries in your books.
        </p>
      </div>

      {status.hasDemoData ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-surface p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-on-surface">Demo data is loaded</span>
            <span className="text-[13px] text-on-surface-muted">Removing it only deletes demo records — your real data is never touched.</span>
          </div>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Delete all demo data
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-surface p-4">
          <span className="text-[13px] text-on-surface-muted">No demo data is currently loaded.</span>
          {keptContacts > 0 && (
            <span role="status" className="text-[13px] text-on-surface-muted">
              {keptContactsMessage(keptContacts)}
            </span>
          )}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every demo contact, item, quote, invoice, payment, bill, expense, job and meeting, and the entries they
              made in your books. Your own records stay. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting…" : "Delete demo data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SavedToast open={done} onOpenChange={setDone} />
    </div>
  );
}

/** "Kept 1 demo contact that your own records use." */
export function keptContactsMessage(n: number): string {
  return `Kept ${n} demo ${n === 1 ? "contact" : "contacts"} that your own records use.`;
}
