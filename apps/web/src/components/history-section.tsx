"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger, Spinner } from "@spine/ui";
import { History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { describeHistoryEntry } from "@spine/shared";
import { apiClient } from "../lib/api-client";

export interface AuditFieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: AuditFieldChange[] | null;
  createdAt: string;
  actorUserId: string | null;
  actorName: string | null;
}

/**
 * A subtle "History" trigger button that opens a Dialog on click, rather
 * than rendering the list inline and unconditionally — user feedback was
 * that an always-visible, always-fetched history block was noise on every
 * document view when almost no one looks at it. The `GET .../:id/history`
 * request is deferred until the dialog actually opens (the effect below is
 * gated on `open`), not fired on mount, so a page whose History dialog is
 * never opened costs nothing extra — same "only poll/fetch while open"
 * convention as EmailQueueDialog. `subjectLabel` is the human phrase
 * substituted into "{actor} {verb} {subjectLabel}" — e.g. "this invoice".
 * Every entry is worded by `describeHistoryEntry` (US-SET-13).
 */
export function HistorySection({
  endpoint,
  subjectLabel,
  ownEntityType,
  open: controlledOpen,
  onOpenChange,
}: {
  endpoint: string;
  subjectLabel: string;
  /** For a history that also lists related records (a contact's invoices, say): which entries are this record's own. */
  ownEntityType?: string;
  /** Opened from elsewhere (e.g. a "View history" menu item, US-QUO-24): no icon button is rendered. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : ownOpen;
  const setOpen = controlled ? (onOpenChange ?? (() => {})) : setOwnOpen;
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    if (!open || entries !== null) return;
    apiClient.get<AuditEntry[]>(endpoint).then(setEntries);
  }, [open, entries, endpoint]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="View history" className="h-8 w-8 shrink-0 text-on-surface-muted">
            <History size={16} />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>History</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {entries === null ? (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : entries.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 rounded-md border border-border-strong bg-surface px-3 py-2 text-[13px]">
                  <span className="text-on-surface">{describeHistoryEntry(entry, subjectLabel, ownEntityType)}</span>
                  <span className="shrink-0 whitespace-nowrap text-on-surface-muted" title={new Date(entry.createdAt).toLocaleString()}>
                    {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-on-surface-muted">No history yet.</p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
