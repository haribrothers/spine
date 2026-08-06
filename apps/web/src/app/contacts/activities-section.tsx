"use client";

import { useState } from "react";
import { Badge, Button, Checkbox, FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Spinner, Textarea } from "@spine/ui";
import { apiClient } from "../../lib/api-client";
import type { Activity, ActivityType } from "./types";

const TYPE_OPTIONS: ActivityType[] = ["call", "meeting", "note", "task"];

/** S-01.6 — "log a call or site visit against a contact with a follow-up date." */
export function ActivitiesSection({ contactId, activities, onChanged }: { contactId: string; activities: Activity[] | null; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<ActivityType>("call");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleAdd() {
    setSaving(true);
    try {
      await apiClient.post("/activities", {
        contactId,
        type,
        notes: notes || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      });
      setNotes("");
      setDueAt("");
      setType("call");
      setAdding(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(activity: Activity) {
    setTogglingId(activity.id);
    try {
      await apiClient.post(`/activities/${activity.id}/${activity.doneAt ? "undone" : "done"}`);
      onChanged();
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[14px] font-semibold text-on-surface">Activities</h3>
      {activities === null ? (
        <Spinner size="sm" />
      ) : activities.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {activities.map((activity) => {
            const overdue = !activity.doneAt && activity.dueAt && new Date(activity.dueAt) < new Date();
            return (
              <li key={activity.id} className="flex items-center gap-3 rounded-md border border-border-strong px-3 py-2 text-[13px]">
                <Checkbox
                  checked={Boolean(activity.doneAt)}
                  onCheckedChange={() => handleToggle(activity)}
                  disabled={togglingId === activity.id}
                />
                <div className="flex-1">
                  <span className="font-medium capitalize text-on-surface">{activity.type}</span>
                  {activity.notes && <span className="text-on-surface-muted"> · {activity.notes}</span>}
                  {activity.dueAt && (
                    <span className="text-on-surface-muted"> · due {new Date(activity.dueAt).toLocaleDateString()}</span>
                  )}
                </div>
                {overdue && <Badge>Overdue</Badge>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-on-surface-muted">No activities logged.</p>
      )}

      {adding ? (
        <div className="flex flex-col gap-2 rounded-md border border-border-strong p-3">
          <FormField label="Type">
            {(field) => (
              <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
                <SelectTrigger {...field} className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      <span className="capitalize">{t}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="Notes">
            {(field) => <Textarea {...field} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}
          </FormField>
          <FormField label="Follow-up date" helperText="Leave blank if there's nothing to follow up on.">
            {(field) => <Input {...field} type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />}
          </FormField>
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={handleAdd}>
              {saving ? <Spinner size="sm" /> : "Log activity"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" className="self-start" onClick={() => setAdding(true)}>
          Log activity
        </Button>
      )}
    </section>
  );
}
