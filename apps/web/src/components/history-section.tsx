"use client";

import { useEffect, useState } from "react";
import { Card, Spinner } from "@spine/ui";
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
 * A reverse-chronological read of a `GET .../:id/history` endpoint backed
 * by real `audit_log` rows (`AuditLogService.listForEntity`) — the generic
 * counterpart to `contacts/history-section.tsx` (which predates this and
 * stays contact-specific, since it also merges in sub-entity rows like
 * contact_person/address/lead/activity that this simpler single-entity
 * version doesn't need). `subjectLabel` is the human phrase substituted
 * into "{actor} {verb} {subjectLabel}" — e.g. "this invoice".
 */
export function HistorySection({ endpoint, subjectLabel }: { endpoint: string; subjectLabel: string }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    setEntries(null);
    apiClient.get<AuditEntry[]>(endpoint).then(setEntries);
  }, [endpoint]);

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-[14px] font-semibold text-on-surface">History</h3>
      {entries === null ? (
        <Spinner size="sm" />
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
    </Card>
  );
}
