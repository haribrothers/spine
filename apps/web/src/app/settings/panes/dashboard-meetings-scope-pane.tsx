"use client";

import { useState } from "react";
import { Button, RadioGroup, RadioGroupItem, Spinner, cn } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { useSettingsValue } from "../use-settings-value";
import { SavedToast } from "../saved-toast";

export type DashboardMeetingsScope = "own" | "org";

const SCOPES: { value: DashboardMeetingsScope; title: string; description: string }[] = [
  {
    value: "own",
    title: "Only my meetings",
    description: "Each person's dashboard shows only the meetings they organize.",
  },
  {
    value: "org",
    title: "Every org meeting",
    description: "Everyone's dashboard shows every meeting in the org, not just their own — useful for a small team that plans as one calendar.",
  },
];

/**
 * S-10.19 — org preference behind the dashboard's "upcoming meetings"
 * widget (S-09.12). Owner-editable, applies to every Owner/Staff viewer —
 * Field always sees own-meetings-only regardless of this setting, enforced
 * server-side in `MeetingsService.upcomingForDashboard`, so there's no
 * "org" option shown here that could widen Field's access; this pane only
 * ever governs the Owner/Staff experience.
 */
export function DashboardMeetingsScopePane() {
  const { value, ready } = useSettingsValue<{ scope: DashboardMeetingsScope }>("dashboard_meetings_scope", { scope: "own" });

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return <DashboardMeetingsScopeForm initialScope={value.scope} />;
}

function DashboardMeetingsScopeForm({ initialScope }: { initialScope: DashboardMeetingsScope }) {
  const [scope, setScope] = useState<DashboardMeetingsScope>(initialScope);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await apiClient.put("/org/settings/dashboard_meetings_scope", { value: { scope } });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">Upcoming meetings</h2>
        <p className="text-[13px] text-on-surface-muted">
          Choose which meetings the dashboard&apos;s &quot;Today&quot; card shows.
        </p>
      </div>

      <RadioGroup value={scope} onValueChange={(v) => setScope(v as DashboardMeetingsScope)} className="gap-3">
        {SCOPES.map((s) => (
          <label
            key={s.value}
            htmlFor={`dashboard-meetings-scope-${s.value}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
              scope === s.value ? "border-primary bg-primary/5" : "border-border-strong",
            )}
          >
            <RadioGroupItem value={s.value} id={`dashboard-meetings-scope-${s.value}`} className="mt-0.5" />
            <div>
              <p className="text-[14px] font-medium text-on-surface">{s.title}</p>
              <p className="text-[13px] text-on-surface-muted">{s.description}</p>
            </div>
          </label>
        ))}
      </RadioGroup>

      <p className="text-[12px] text-on-surface-muted">Field users always see only their own meetings, regardless of this setting.</p>

      <Button onClick={handleSave} disabled={saving} className="ml-auto">
        {saving ? <Spinner size="sm" /> : "Save"}
      </Button>

      <SavedToast open={saved} onOpenChange={setSaved} />
    </div>
  );
}
