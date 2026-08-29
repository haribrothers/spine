"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger, Spinner } from "@spine/ui";
import { History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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

const ACTION_VERBS: Record<string, string> = {
  created: "created",
  updated: "updated",
  issued: "issued",
  voided: "voided",
  deleted: "deleted",
  archived: "archived",
  restored: "restored",
  email_queued: "emailed",
  reminder_queued: "sent a reminder for",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "empty";
  if (typeof value === "string" && value.length > 60) return `${value.slice(0, 60)}…`;
  return String(value);
}

/**
 * Renders one entry as "{actor} {verb} {subjectLabel}[: field change]" —
 * e.g. "Jane Doe updated this invoice: notes empty → Rush order". `changes`
 * (an array of `{field, from, to}`, per AuditLogService's shallow-diff
 * shape) drives the optional "field a → b" suffix; entries with no changes
 * (issue/void/delete, which are state transitions with nothing to diff)
 * just show the sentence without a suffix.
 */
function describeEntry(entry: AuditEntry, subjectLabel: string): string {
  const actor = entry.actorName ?? "Someone";
  const verb = ACTION_VERBS[entry.action] ?? entry.action;
  const base = `${actor} ${verb} ${subjectLabel}`;

  if (!entry.changes || entry.changes.length === 0) {
    return base;
  }

  const fieldSummary = entry.changes.map((c) => `${c.field} ${formatValue(c.from)} → ${formatValue(c.to)}`).join(", ");
  return `${base}: ${fieldSummary}`;
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
 */
export function HistorySection({ endpoint, subjectLabel }: { endpoint: string; subjectLabel: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    if (!open || entries !== null) return;
    apiClient.get<AuditEntry[]>(endpoint).then(setEntries);
  }, [open, entries, endpoint]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="self-start gap-1.5 text-on-surface-muted">
          <History size={14} />
          History
        </Button>
      </DialogTrigger>
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
                <li key={entry.id} className="flex items-start justify-between gap-3 rounded-md border border-border-strong px-3 py-2 text-[13px]">
                  <span className="text-on-surface">{describeEntry(entry, subjectLabel)}</span>
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
