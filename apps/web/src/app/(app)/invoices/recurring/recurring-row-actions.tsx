"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@spine/ui";
import type { RecurringInvoice } from "@spine/shared";
import { MoreHorizontal } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";

/**
 * US-INV-22 — a schedule's row menu: Edit, Pause or Resume, and Delete
 * (confirmed; invoices it already created are kept).
 */
export function RecurringRowActions({
  schedule,
  onEdit,
  onChanged,
  onDeleted,
  onError,
}: {
  schedule: RecurringInvoice;
  onEdit: (schedule: RecurringInvoice) => void;
  onChanged: (schedule: RecurringInvoice, action: "paused" | "resumed") => void;
  onDeleted: (schedule: RecurringInvoice) => void;
  onError: (message: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function act(action: "pause" | "resume") {
    setBusy(true);
    try {
      const saved = await apiClient.post<RecurringInvoice>(`/recurring-invoices/${schedule.id}/${action}`);
      onChanged(saved, action === "pause" ? "paused" : "resumed");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't change the schedule. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await apiClient.delete(`/recurring-invoices/${schedule.id}`);
      setConfirmOpen(false);
      onDeleted(schedule);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't delete the schedule. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${schedule.name}`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit(schedule)}>Edit</DropdownMenuItem>
          {schedule.status === "active" && (
            <DropdownMenuItem disabled={busy} onSelect={() => act("pause")}>
              Pause
            </DropdownMenuItem>
          )}
          {schedule.status === "paused" && (
            <DropdownMenuItem disabled={busy} onSelect={() => act("resume")}>
              Resume
            </DropdownMenuItem>
          )}
          <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this schedule?</AlertDialogTitle>
            <AlertDialogDescription>Invoices it already created are kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" disabled={busy} onClick={handleDelete}>
              Delete schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
