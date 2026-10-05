"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Alert, AlertDescription, Button, Checkbox, Label, Spinner } from "@spine/ui";
import { formatBytes, type DataExportFormat, type DataExportSummary } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** "Sep 30, 2026" */
function day(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function expiresIn(iso: string): string {
  const days = Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000));
  return days <= 1 ? "link expires within a day" : `link expires in ${days} days`;
}

/**
 * US-SET-15/16 (D-094) — Settings › Data export: choose CSV (default), JSON
 * and files, then "Prepare export". The ZIP is built in the background;
 * the Owner is emailed a link back here when it's ready. "Last export"
 * shows who ran it, when, its size and "Download again" until the link
 * expires after 7 days.
 */
export function DataExportPane() {
  const [csv, setCsv] = useState(true);
  const [json, setJson] = useState(false);
  const [withFiles, setWithFiles] = useState(true);
  const [last, setLast] = useState<DataExportSummary | null | undefined>(undefined);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { csv: useId(), json: useId(), files: useId() };

  const load = useCallback(() => {
    apiClient
      .get<{ export: DataExportSummary | null }>("/org/exports")
      .then((res) => setLast(res.export))
      .catch(() => setLast(null));
  }, []);

  useEffect(load, [load]);

  const preparing = starting || last?.status === "preparing";

  // While preparing, check back every few seconds.
  useEffect(() => {
    if (last?.status !== "preparing") return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [last?.status, load]);

  async function prepare() {
    const formats: DataExportFormat[] = [...(csv ? (["csv"] as const) : []), ...(json ? (["json"] as const) : [])];
    if (formats.length === 0) {
      setError("Choose CSV, JSON or both.");
      return;
    }
    setError(null);
    setStarting(true);
    try {
      setLast(await apiClient.post<DataExportSummary>("/org/exports", { formats, includeFiles: withFiles }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The export couldn't start. Try again.");
    } finally {
      setStarting(false);
    }
  }

  if (last === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-5" data-testid="data-export">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">Data export</h2>
        <p className="text-[13px] text-on-surface-muted">
          Download everything in your Spine as one file. Your data is yours — use this to keep your own copy or move to another system.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Option id={ids.csv} checked={csv} onChange={setCsv} label="Records as CSV" hint="One CSV per table: contacts, quotes, invoices, payments, jobs, bills, expenses, journal entries and more." />
        <Option id={ids.json} checked={json} onChange={setJson} label="Records as JSON" hint="The same data as JSON, for importing into other software." />
        <Option id={ids.files} checked={withFiles} onChange={setWithFiles} label="Files" hint="Receipts, photos, signatures, logos and issued PDFs, in their original format." />
      </div>

      {last && last.status !== "expired" && (
        <div className="rounded-md border border-border bg-surface-sunken px-4 py-3 text-[13px] text-on-surface" data-testid="last-export">
          {last.status === "preparing" ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" /> Preparing the export {last.requestedBy ? `${last.requestedBy} asked for` : "asked for"} on {day(last.createdAt)}…
            </span>
          ) : (
            <span>
              <strong className="font-semibold">Last export:</strong> {day(last.createdAt)}
              {last.requestedBy ? ` by ${last.requestedBy}` : ""}
              {last.sizeBytes !== null ? ` · ${formatBytes(last.sizeBytes)}` : ""} ·{" "}
              <a href={`${API_URL}/org/exports/${last.id}/download`} className="text-primary hover:underline">
                Download again
              </a>{" "}
              ({last.expiresAt ? expiresIn(last.expiresAt) : "link expires in 7 days"})
            </span>
          )}
        </div>
      )}

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-[13px] text-on-surface-muted">Large exports are prepared in the background. We&apos;ll email you when the file is ready.</p>

      <div className="mt-auto">
        <Button onClick={prepare} disabled={preparing}>
          {preparing ? (
            <>
              <Spinner size="sm" /> Preparing…
            </>
          ) : (
            "Prepare export"
          )}
        </Button>
      </div>
    </div>
  );
}

function Option({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className="text-[14px] font-semibold text-on-surface">
          {label}
        </Label>
        <span className="text-[13px] text-on-surface-muted">{hint}</span>
      </div>
    </div>
  );
}
