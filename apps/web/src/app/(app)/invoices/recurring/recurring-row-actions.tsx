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
import type { RecurringStatus } from "@spine/shared";
import { MoreHorizontal } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import { useT } from "../../../../lib/i18n";

/**
 * US-INV-22, US-PUR-31 — a schedule's row menu: Edit, Pause or Resume, and
 * Delete (confirmed; what it already created is kept). Shared by recurring
 * invoices and recurring bills.
 */
export function RecurringRowActions<T extends { id: string; name: string; status: RecurringStatus }>({
  schedule,
  endpoint = "/recurring-invoices",
  keptText,
  onEdit,
  onChanged,
  onDeleted,
  onError,
}: {
  schedule: T;
  /** The schedules' API route, e.g. "/recurring-bills". */
  endpoint?: string;
  /** What the delete confirmation says is kept. */
  keptText?: string;
  onEdit: (schedule: T) => void;
  onChanged: (schedule: T, action: "paused" | "resumed") => void;
  onDeleted: (schedule: T) => void;
  onError: (message: string) => void;
}) {
  const t = useT();
  const kept = keptText ?? t("invoices.recurringRow.keptText");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function act(action: "pause" | "resume") {
    setBusy(true);
    try {
      const saved = await apiClient.post<T>(`${endpoint}/${schedule.id}/${action}`);
      onChanged(saved, action === "pause" ? "paused" : "resumed");
    } catch (err) {
      onError(err instanceof Error ? err.message : t("invoices.recurringRow.changeFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await apiClient.delete(`${endpoint}/${schedule.id}`);
      setConfirmOpen(false);
      onDeleted(schedule);
    } catch (err) {
      onError(err instanceof Error ? err.message : t("invoices.recurringRow.deleteFailed"));
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
            aria-label={t("invoices.recurringRow.actionsFor", { name: schedule.name })}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit(schedule)}>{t("invoices.recurringRow.edit")}</DropdownMenuItem>
          {schedule.status === "active" && (
            <DropdownMenuItem disabled={busy} onSelect={() => act("pause")}>
              {t("invoices.recurringRow.pause")}
            </DropdownMenuItem>
          )}
          {schedule.status === "paused" && (
            <DropdownMenuItem disabled={busy} onSelect={() => act("resume")}>
              {t("invoices.recurringRow.resume")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
            {t("invoices.recurringRow.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("invoices.recurringRow.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{kept}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("invoices.recurringRow.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="danger" disabled={busy} onClick={handleDelete}>
              {t("invoices.recurringRow.deleteSchedule")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
