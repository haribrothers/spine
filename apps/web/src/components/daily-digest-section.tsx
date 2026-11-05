"use client";

import { useId, useState } from "react";
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@spine/ui";
import { DIGEST_DAYS, DIGEST_DAYS_LABELS, DIGEST_TIMES, digestTimeLabel, type DigestDays, type NotificationPreferences } from "@spine/shared";
import { apiClient } from "../lib/api-client";
import { useT } from "../lib/i18n";

/**
 * US-NTF-14 (D-093) — "Daily digest" on Profile › Notifications: on or off,
 * "Send at" (organisation time) and "Days". Each change saves straight
 * away. Owners start with it on at 7:00 AM Monday to Friday; others off.
 */
export function DailyDigestSection({
  value,
  onSaved,
  onError,
  timeZone,
}: {
  value: NotificationPreferences;
  /** US-AUTH-19 — the business's time zone, named under the times. */
  timeZone?: string;
  onSaved: (next: NotificationPreferences) => void;
  onError: (message: string) => void;
}) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const switchId = useId();
  const timeId = useId();
  const daysId = useId();
  // Keep a stored time that isn't one of the half-hour choices selectable.
  const times = DIGEST_TIMES.some((time) => time.value === value.digestTime) ? DIGEST_TIMES : [...DIGEST_TIMES, { value: value.digestTime, label: digestTimeLabel(value.digestTime) }];

  async function save(next: NotificationPreferences) {
    setSaving(true);
    try {
      const saved = await apiClient.put<NotificationPreferences>("/users/me/notification-preferences", next);
      onSaved({ digestEnabled: saved.digestEnabled, digestTime: saved.digestTime, digestDays: saved.digestDays });
    } catch (err) {
      onError(err instanceof Error ? err.message : t("common.dailyDigest.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5" aria-labelledby={`${switchId}-heading`} data-testid="daily-digest">
      <h3 id={`${switchId}-heading`} className="text-[15px] font-semibold text-on-surface">
        {t("common.dailyDigest.heading")}
      </h3>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={switchId} className="text-[14px] font-semibold text-on-surface">
            {t("common.dailyDigest.switchLabel")}
          </Label>
          <p className="text-[13px] text-on-surface-muted">{t("common.dailyDigest.switchHint")}</p>
        </div>
        <Switch id={switchId} checked={value.digestEnabled} disabled={saving} onCheckedChange={(checked) => save({ ...value, digestEnabled: checked })} />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={timeId}>{t("common.dailyDigest.sendAt")}</Label>
          <Select value={value.digestTime} disabled={saving || !value.digestEnabled} onValueChange={(digestTime) => save({ ...value, digestTime })}>
            <SelectTrigger id={timeId} className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {times.map((time) => (
                <SelectItem key={time.value} value={time.value}>
                  {time.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={daysId}>{t("common.dailyDigest.days")}</Label>
          <Select value={value.digestDays} disabled={saving || !value.digestEnabled} onValueChange={(digestDays) => save({ ...value, digestDays: digestDays as DigestDays })}>
            <SelectTrigger id={daysId} className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...DIGEST_DAYS].reverse().map((d) => (
                <SelectItem key={d} value={d}>
                  {DIGEST_DAYS_LABELS[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-[12px] text-on-surface-muted">{timeZone ? t("common.dailyDigest.timeZoneNamed", { timeZone }) : t("common.dailyDigest.timeZoneOrg")}</p>
    </section>
  );
}
