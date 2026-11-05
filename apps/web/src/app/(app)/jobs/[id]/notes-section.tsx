"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Card, Spinner, Textarea } from "@spine/ui";
import { apiClient } from "../../../../lib/api-client";
import { useT } from "../../../../lib/i18n";
import { useCapability } from "../../../../lib/capabilities-context";
import { HistorySection } from "../../../../components/history-section";
import type { Job, JobNote } from "../types";
import { orgLocaleTag } from "../../../../lib/money";

/** A free-text timeline note (site conditions, a call with the customer, etc.) — simple append-only list, field-reachable same as photos. */
/** `onChanged` lets the job page refresh its tab count and Activity (US-JOB-35, US-JOB-37). */
export function NotesSection({ job, onChanged }: { job: Job; onChanged?: () => void }) {
  const t = useT();
  const canAdd = useCapability("job_notes.edit_own");
  const [notes, setNotes] = useState<JobNote[] | null>(null);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiClient
      .get<JobNote[]>(`/jobs/${job.id}/notes`)
      .then(setNotes)
      .catch((err) => setError(err instanceof Error ? err.message : t("jobs.notes.loadFailed")));
  }, [job.id, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    if (!body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`/jobs/${job.id}/notes`, { body: body.trim() });
      setBody("");
      load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("jobs.notes.addFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <h3 className="text-[14px] font-semibold text-on-surface">{t("jobs.notes.title")}</h3>

      {canAdd && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("jobs.notes.placeholder")}
            rows={2}
            className="flex-1"
          />
          <Button type="button" onClick={handleAdd} disabled={saving || !body.trim()}>
            {saving ? <Spinner size="sm" /> : t("jobs.notes.add")}
          </Button>
        </div>
      )}

      {!notes ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-[13px] text-on-surface-muted">{t("jobs.notes.empty")}</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {notes.map((note) => (
            <div key={note.id} className="flex items-start justify-between gap-3 py-2.5">
              <div>
                <p className="text-[13px] text-on-surface">{note.body}</p>
                <p className="mt-0.5 text-[11px] text-on-surface-muted">{new Date(note.createdAt).toLocaleString(orgLocaleTag())}</p>
              </div>
              <HistorySection endpoint={`/jobs/${job.id}/notes/${note.id}/history`} subjectLabel={t("jobs.notes.historySubject")} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
