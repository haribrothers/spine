"use client";

import { useState } from "react";
import { Button, RadioGroup, RadioGroupItem, Spinner, cn } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { useSettingsValue } from "../use-settings-value";
import { SavedToast } from "../saved-toast";

const LEAD_TIME_OPTIONS = [5, 15, 30, 60] as const;

/**
 * S-10.22 — org-wide default lead time for the S-10.21 "starting soon"
 * meeting reminder. Any user can override this for themselves from their
 * own Profile & Preferences page (a personal preference, not an org
 * setting — see CLAUDE.md's "Profile & Preferences is not the same
 * surface as org Settings" rule); this pane only sets the org default that
 * applies to anyone who hasn't set their own override.
 */
export function MeetingReminderLeadTimePane() {
  const { value, ready } = useSettingsValue<{ minutes: number }>("meeting_reminder_lead_minutes", { minutes: 15 });

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return <MeetingReminderLeadTimeForm initialMinutes={value.minutes} />;
}

function MeetingReminderLeadTimeForm({ initialMinutes }: { initialMinutes: number }) {
  const [minutes, setMinutes] = useState(initialMinutes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await apiClient.put("/org/settings/meeting_reminder_lead_minutes", { value: { minutes } });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">Meeting reminders</h2>
        <p className="text-[13px] text-on-surface-muted">
          Default lead time for the &quot;meeting starting soon&quot; notification, before someone has set their own
          override.
        </p>
      </div>

      <RadioGroup value={String(minutes)} onValueChange={(v) => setMinutes(Number(v))} className="gap-3">
        {LEAD_TIME_OPTIONS.map((option) => (
          <label
            key={option}
            htmlFor={`meeting-reminder-lead-${option}`}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors",
              minutes === option ? "border-primary bg-primary/5" : "border-border-strong",
            )}
          >
            <RadioGroupItem value={String(option)} id={`meeting-reminder-lead-${option}`} />
            <p className="text-[14px] font-medium text-on-surface">{option} minutes before</p>
          </label>
        ))}
      </RadioGroup>

      <p className="text-[12px] text-on-surface-muted">
        Any user can override this for themselves from their Profile &amp; Preferences page.
      </p>

      <Button onClick={handleSave} disabled={saving} className="ml-auto">
        {saving ? <Spinner size="sm" /> : "Save"}
      </Button>

      <SavedToast open={saved} onOpenChange={setSaved} />
    </div>
  );
}
