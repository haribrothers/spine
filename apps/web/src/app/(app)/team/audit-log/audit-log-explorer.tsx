"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShellHeader, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Spinner, cn } from "@spine/ui";
import { auditActionLabel, auditActionTone, auditDetails, auditEntityLabel, AUDIT_PAGE_SIZE, type AuditLogPage } from "@spine/shared";
import { Download } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const ALL = "all";

const TONE: Record<ReturnType<typeof auditActionTone>, string> = {
  positive: "bg-paid-bg text-paid",
  negative: "bg-overdue-bg text-overdue",
  info: "bg-info-bg text-primary",
  neutral: "bg-surface-sunken text-on-surface",
};

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Today, 10:42 AM", "Yesterday, 4:12 PM", "3 Oct, 2:30 PM". */
function when(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const days = Math.round((new Date(isoDay(new Date())).getTime() - new Date(isoDay(d)).getTime()) / 86_400_000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) })}, ${time}`;
}

/**
 * US-SET-11/12 (D-064) — every change to records in the organisation,
 * newest first: When, Who, Action, Record (opens it) and Details. Filters
 * for dates, person, record type and action; 50 a page; "Export CSV" of
 * the filtered entries.
 */
export function AuditLogExplorer() {
  const params = useSearchParams();
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  // US-TEAM-29: opened for one record ("Open in audit log" on a Team), its whole history shows.
  const [entityId, setEntityId] = useState(params.get("entityId") ?? "");
  const [from, setFrom] = useState(entityId ? "" : isoDay(monthAgo));
  const [to, setTo] = useState(isoDay(new Date()));
  const [person, setPerson] = useState(ALL);
  const [entityType, setEntityType] = useState(params.get("entityType") ?? ALL);
  const [action, setAction] = useState(ALL);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<AuditLogPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [business, setBusiness] = useState("your organisation");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (person !== ALL) p.set("userId", person);
    if (entityType !== ALL) p.set("entityType", entityType);
    if (action !== ALL) p.set("action", action);
    if (entityId) p.set("entityId", entityId);
    return p.toString();
  }, [from, to, person, entityType, action, entityId]);

  useEffect(() => {
    apiClient
      .get<{ value: { name?: string } | null }>("/org/settings/business_profile")
      .then((res) => res.value?.name?.trim() && setBusiness(res.value.name.trim()))
      .catch(() => {});
  }, []);

  // Changing a filter starts again from the first page.
  useEffect(() => setOffset(0), [query]);

  useEffect(() => {
    setError(null);
    apiClient
      .get<AuditLogPage>(`/org/audit-log?${query}&cursor=${offset}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load the audit log. Refresh to try again."));
  }, [query, offset]);

  const facets = data?.facets;
  const total = data?.total ?? 0;
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + AUDIT_PAGE_SIZE, total);

  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Team" }, { label: "Audit log" }]}
        title="Audit log"
        description={`Every change to records in ${business}, newest first. Only owners can see this page.`}
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-from">From</Label>
            <Input id="audit-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-to">To</Label>
            <Input id="audit-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <FilterSelect id="audit-person" label="Person" value={person} onChange={setPerson} allLabel="Everyone" options={(facets?.people ?? []).map((p) => ({ value: p.userId, label: p.name }))} />
          <FilterSelect id="audit-type" label="Record type" value={entityType} onChange={setEntityType} allLabel="All types" options={(facets?.entityTypes ?? []).map((t) => ({ value: t, label: auditEntityLabel(t) }))} />
          <FilterSelect id="audit-action" label="Action" value={action} onChange={setAction} allLabel="All actions" options={(facets?.actions ?? []).map((a) => ({ value: a, label: auditActionLabel(a) }))} />
          {entityId && (
            <Button variant="secondary" onClick={() => setEntityId("")} data-testid="audit-one-record">
              One record · Show all
            </Button>
          )}
          <Button asChild variant="secondary" className="ml-auto">
            <a href={`${API_URL}/org/audit-log.csv?${query}`} data-testid="audit-export">
              <Download size={14} aria-hidden="true" />
              Export CSV
            </a>
          </Button>
        </div>

        {error ? (
          <p className="text-[13px] text-overdue">{error}</p>
        ) : !data ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[760px] text-[14px]" data-testid="audit-table">
              <thead className="bg-surface-sunken text-left text-[13px] text-on-surface-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Who</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Record</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-on-surface-muted">
                      No changes match these filters. Widen the dates or clear a filter.
                    </td>
                  </tr>
                ) : (
                  data.entries.map((e) => {
                    const record = `${auditEntityLabel(e.entityType)}${e.recordLabel ? ` · ${e.recordLabel}` : ""}`;
                    return (
                      <tr key={e.id} data-entry={e.id} data-type={e.entityType}>
                        <td className="whitespace-nowrap px-4 py-3 text-on-surface">{when(e.createdAt)}</td>
                        <td className="px-4 py-3 text-on-surface">{e.actor?.name ?? <span className="text-on-surface-muted">Customer or system</span>}</td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-block rounded-md px-2 py-0.5 text-[12px] font-semibold", TONE[auditActionTone(e.action)])}>{auditActionLabel(e.action)}</span>
                        </td>
                        <td className="px-4 py-3">
                          {e.link ? (
                            <Link href={e.link} className="text-primary hover:underline">
                              {record}
                            </Link>
                          ) : (
                            <span className="text-on-surface">{record}</span>
                          )}
                        </td>
                        <td className="max-w-[360px] px-4 py-3 text-on-surface">{auditDetails(e) || <span className="text-on-surface-muted">—</span>}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {data && total > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-on-surface-muted" data-testid="audit-range">
              {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()} {total === 1 ? "entry" : "entries"}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - AUDIT_PAGE_SIZE))}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={last >= total} onClick={() => setOffset(offset + AUDIT_PAGE_SIZE)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
