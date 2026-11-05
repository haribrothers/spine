"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
} from "@spine/ui";
import { CalendarPlus, NotebookPen, Pencil } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import type { Activity, ActivityType } from "./types";
import { t as translate, useT } from "../../../lib/i18n";
import { orgLocaleTag } from "../../../lib/money";

const TYPE_OPTIONS: ActivityType[] = ["call", "meeting", "note", "task"];

/**
 * S-01.6 — "log a call or site visit against a contact with a follow-up
 * date." "Log activity"/"Edit activity" share the same Dialog (Issue 4
 * pattern) — `editingId` set means editing via `PUT /activities/:id`, null
 * means creating via `POST /activities`.
 *
 * US-CRM-27: the lead drawer uses it too — `leadId` links new activities to
 * the lead, and `followUps` adds "Add follow-up" (the same dialog, with the
 * date required).
 */
export function ActivitiesSection({
  contactId,
  leadId,
  heading = translate("contacts.activities.heading"),
  followUps = false,
  activities,
  onChanged,
  onCreated,
}: {
  contactId: string;
  leadId?: string;
  heading?: string;
  followUps?: boolean;
  activities: Activity[] | null;
  onChanged: () => void;
  onCreated?: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [asFollowUp, setAsFollowUp] = useState(false);
  const [type, setType] = useState<ActivityType>("call");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const canCreate = useCapability("activities.edit_own");

  function openAddDialog(followUp = false) {
    setEditingId(null);
    setAsFollowUp(followUp);
    setType("call");
    setNotes("");
    setDueAt("");
    setOpen(true);
  }

  function openEditDialog(activity: Activity) {
    setEditingId(activity.id);
    setAsFollowUp(false);
    setType(activity.type);
    setNotes(activity.notes ?? "");
    setDueAt(activity.dueAt ? activity.dueAt.slice(0, 10) : "");
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        await apiClient.put(`/activities/${editingId}`, {
          type,
          notes: notes || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        });
      } else {
        await apiClient.post("/activities", {
          contactId,
          ...(leadId ? { leadId } : {}),
          type,
          notes: notes || undefined,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        });
      }
      setOpen(false);
      onChanged();
      if (!editingId) onCreated?.();
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
    <section className="flex flex-col gap-3" aria-label={heading}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-on-surface">{heading}</h3>
        {followUps && canCreate && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => openAddDialog()}>
              <NotebookPen size={14} aria-hidden />
              {t("contacts.activities.log")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => openAddDialog(true)}>
              <CalendarPlus size={14} aria-hidden />
              {t("contacts.activities.addFollowUp")}
            </Button>
          </div>
        )}
      </div>
      {activities === null ? (
        <Spinner size="sm" />
      ) : activities.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {activities.map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              onToggle={handleToggle}
              onEdit={openEditDialog}
              toggling={togglingId === activity.id}
            />
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-on-surface-muted">{followUps ? t("contacts.activities.noFollowUps") : t("contacts.activities.noActivities")}</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        {canCreate && !followUps && (
          <Button size="sm" variant="secondary" className="self-start" onClick={() => openAddDialog()}>
            {t("contacts.activities.log")}
          </Button>
        )}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t("contacts.activities.edit") : asFollowUp ? t("contacts.activities.addFollowUp") : t("contacts.activities.log")}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <FormField label={t("contacts.activities.type")}>
              {(field) => (
                <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
                  <SelectTrigger {...field} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        <span className="capitalize">{t(`contacts.activities.types.${option}`)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField label={t("contacts.activities.notes")}>
              {(field) => <Textarea {...field} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}
            </FormField>
            <FormField label={t("contacts.activities.followUpDate")} helperText={asFollowUp ? t("contacts.activities.followUpHelper") : t("contacts.activities.followUpBlankHelper")}>
              {(field) => <Input {...field} type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("contacts.common.cancel")}
            </Button>
            <Button disabled={saving || (asFollowUp && !dueAt)} onClick={handleSave}>
              {saving ? <Spinner size="sm" /> : editingId ? t("contacts.activities.saveChanges") : asFollowUp ? t("contacts.activities.addFollowUp") : t("contacts.activities.log")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/**
 * Extracted per-row so `useCanEditOwnership` can be called normally —
 * calling it once per item inside the parent's `.map()` would violate the
 * Rules of Hooks the moment the activity count changes between renders.
 * `edit_own`/`edit_others` gates both the Edit button AND the done/undone
 * Checkbox, since toggling completion is a form of editing the record —
 * matching ActivitiesService.markDone/markUndone's own server-side gate.
 */
function ActivityRow({
  activity,
  onToggle,
  onEdit,
  toggling,
}: {
  activity: Activity;
  onToggle: (activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  toggling: boolean;
}) {
  const t = useT();
  const canEdit = useCanEditOwnership(activity.createdByUserId, { own: "activities.edit_own", others: "activities.edit_others" });
  const overdue = !activity.doneAt && activity.dueAt && new Date(activity.dueAt) < new Date();

  return (
    <li className="flex items-center gap-3 rounded-md border border-border-strong bg-surface px-3 py-2 text-[13px]">
      <Checkbox
        checked={Boolean(activity.doneAt)}
        onCheckedChange={() => onToggle(activity)}
        disabled={!canEdit || toggling}
      />
      <div className="flex-1">
        <span className="font-medium capitalize text-on-surface">{t(`contacts.activities.types.${activity.type}`)}</span>
        {activity.notes && <span className="text-on-surface-muted"> · {activity.notes}</span>}
        {activity.dueAt && <span className="text-on-surface-muted">{t("contacts.activities.due", { date: new Date(activity.dueAt).toLocaleDateString(orgLocaleTag()) })}</span>}
      </div>
      {overdue && <Badge>{t("contacts.activities.overdue")}</Badge>}
      {canEdit && (
        <button
          type="button"
          aria-label={t("contacts.activities.edit")}
          onClick={() => onEdit(activity)}
          className="text-on-surface-muted transition-colors hover:text-on-surface"
        >
          <Pencil size={14} />
        </button>
      )}
    </li>
  );
}
