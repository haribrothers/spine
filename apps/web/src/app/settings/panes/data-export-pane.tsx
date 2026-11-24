"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Alert, AlertDescription, Button, Checkbox, Label, Spinner } from "@spine/ui";
import { formatBytes, type DataExportFormat, type DataExportSummary } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { t, useT } from "../../../lib/i18n";
import { orgLocaleTag } from "../../../lib/money";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** "Sep 30, 2026" */
function day(iso: string): string {
  return new Date(iso).toLocaleDateString(orgLocaleTag(), { month: "short", day: "numeric", year: "numeric" });
}

function expiresIn(iso: string): string {
  const days = Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000));
  return days <= 1 ? t("settings.dataExport.expiresWithinDay") : t("settings.dataExport.expiresInDays", { days });
}

/**
 * US-SET-15/16 (D-094) — Settings › Data export: choose CSV (default), JSON
 * and files, then "Prepare export". The ZIP is built in the background;
 * the Owner is emailed a link back here when it's ready. "Last export"
 * shows who ran it, when, its size and "Download again" until the link
 * expires after 7 days.
 */
export function DataExportPane() {
  const t = useT();
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
      setError(t("settings.dataExport.chooseFormat"));
      return;
    }
    setError(null);
    setStarting(true);
    try {
      setLast(await apiClient.post<DataExportSummary>("/org/exports", { formats, includeFiles: withFiles }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.dataExport.startError"));
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
        <h2 className="text-[15px] font-semibold text-on-surface">{t("settings.dataExport.title")}</h2>
        <p className="text-[13px] text-on-surface-muted">
          {t("settings.dataExport.description")}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Option id={ids.csv} checked={csv} onChange={setCsv} label={t("settings.dataExport.csvLabel")} hint={t("settings.dataExport.csvHint")} />
        <Option id={ids.json} checked={json} onChange={setJson} label={t("settings.dataExport.jsonLabel")} hint={t("settings.dataExport.jsonHint")} />
        <Option id={ids.files} checked={withFiles} onChange={setWithFiles} label={t("settings.dataExport.filesLabel")} hint={t("settings.dataExport.filesHint")} />
      </div>

      {last && last.status !== "expired" && (
        <div className="rounded-md border border-border bg-surface-sunken px-4 py-3 text-[13px] text-on-surface" data-testid="last-export">
          {last.status === "preparing" ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" /> {last.requestedBy ? t("settings.dataExport.preparingBy", { person: last.requestedBy, date: day(last.createdAt) }) : t("settings.dataExport.preparingAnon", { date: day(last.createdAt) })}
            </span>
          ) : (
            <span>
              <strong className="font-semibold">{t("settings.dataExport.lastExport")}</strong> {day(last.createdAt)}
              {last.requestedBy ? t("settings.dataExport.by", { person: last.requestedBy }) : ""}
              {last.sizeBytes !== null ? ` · ${formatBytes(last.sizeBytes)}` : ""} ·{" "}
              <a href={`${API_URL}/org/exports/${last.id}/download`} className="text-primary hover:underline">
                {t("settings.dataExport.downloadAgain")}
              </a>{" "}
              ({last.expiresAt ? expiresIn(last.expiresAt) : t("settings.dataExport.expiresInDays", { days: 7 })})
            </span>
          )}
        </div>
      )}

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-[13px] text-on-surface-muted">{t("settings.dataExport.backgroundNote")}</p>

      <div className="mt-auto">
        <Button onClick={prepare} disabled={preparing}>
          {preparing ? (
            <>
              <Spinner size="sm" /> {t("settings.dataExport.preparingButton")}
            </>
          ) : (
            t("settings.dataExport.prepare")
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
