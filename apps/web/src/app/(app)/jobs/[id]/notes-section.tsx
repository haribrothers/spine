"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Card, Spinner, Textarea } from "@spine/ui";
import { apiClient } from "../../../../lib/api-client";
import type { Job, JobNote } from "../types";

/** A free-text timeline note (site conditions, a call with the customer, etc.) — simple append-only list, field-reachable same as photos. */
export function NotesSection({ job, canAdd }: { job: Job; canAdd: boolean }) {
  const [notes, setNotes] = useState<JobNote[] | null>(null);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiClient
      .get<JobNote[]>(`/jobs/${job.id}/notes`)
      .then(setNotes)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load notes."));
  }, [job.id]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this note.");
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

      <h3 className="text-[14px] font-semibold text-on-surface">Notes</h3>

      {canAdd && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a note about this job…"
            rows={2}
            className="flex-1"
          />
          <Button type="button" onClick={handleAdd} disabled={saving || !body.trim()}>
            {saving ? <Spinner size="sm" /> : "Add"}
          </Button>
        </div>
      )}

      {!notes ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-[13px] text-on-surface-muted">No notes yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {notes.map((note) => (
            <div key={note.id} className="py-2.5">
              <p className="text-[13px] text-on-surface">{note.body}</p>
              <p className="mt-0.5 text-[11px] text-on-surface-muted">{new Date(note.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
