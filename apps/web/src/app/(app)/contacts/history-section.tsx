"use client";

import { useEffect, useState } from "react";
import { Badge, Spinner } from "@spine/ui";
import { formatDistanceToNow } from "date-fns";
import { apiClient } from "../../../lib/api-client";
import type { AuditEntry } from "./types";

const ENTITY_LABELS: Record<AuditEntry["entityType"], string> = {
  contact: "this contact",
  contact_person: "a contact person",
  address: "an address",
  lead: "a lead",
  activity: "an activity",
};

const ACTION_VERBS: Record<string, string> = {
  created: "added",
  updated: "updated",
  archived: "archived",
  restored: "restored",
  deleted: "deleted",
  removed: "removed",
  "marked done": "marked done",
  "marked undone": "marked as not done",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "empty";
  if (typeof value === "string" && value.length > 60) return `${value.slice(0, 60)}…`;
  return String(value);
}

/**
 * Renders one entry as "{actor} {verb} {entity}[: field change]" — e.g.
 * "Jane Doe updated a contact person: phone 555-1234 → 555-5678" or
 * "Jane Doe archived this contact". `changes` (an array of
 * `{field, from, to}`, per AuditLogService's shallow-diff shape) drives the
 * optional "field a → b" suffix; entries with no changes (archive/restore/
 * mark-done, which are state transitions with nothing to diff) just show
 * the sentence without a suffix.
 */
function describeEntry(entry: AuditEntry): string {
  const actor = entry.actorName ?? "Someone";
  const verb = ACTION_VERBS[entry.action] ?? entry.action;
  const subject = entry.entityType === "contact" ? ENTITY_LABELS.contact : ENTITY_LABELS[entry.entityType];
  const base = `${actor} ${verb} ${subject}`;

  if (!entry.changes || entry.changes.length === 0) {
    return base;
  }

  const fieldSummary = entry.changes.map((c) => `${c.field} ${formatValue(c.from)} → ${formatValue(c.to)}`).join(", ");
  return `${base}: ${fieldSummary}`;
}

/**
 * S-10.6's first real slice — a reverse-chronological read of
 * `GET /contacts/:id/history` (real `audit_log` rows, written by
 * AuditLogService from contacts.service.ts/leads.service.ts/
 * activities.service.ts's mutating methods). Actor names are resolved
 * server-side (the endpoint left-joins `user`), so no second lookup is
 * needed here.
 */
export function HistorySection({ contactId }: { contactId: string }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    apiClient.get<AuditEntry[]>(`/contacts/${contactId}/history`).then(setEntries);
  }, [contactId]);

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[14px] font-semibold text-on-surface">History</h3>
      {entries === null ? (
        <Spinner size="sm" />
      ) : entries.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 rounded-md border border-border-strong px-3 py-2 text-[13px]">
              <span className="text-on-surface">{describeEntry(entry)}</span>
              <div className="flex shrink-0 items-center gap-2">
                <Badge>{entry.entityType.replace("_", " ")}</Badge>
                <span className="whitespace-nowrap text-on-surface-muted" title={new Date(entry.createdAt).toLocaleString()}>
                  {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-on-surface-muted">No history yet.</p>
      )}
    </section>
  );
}
