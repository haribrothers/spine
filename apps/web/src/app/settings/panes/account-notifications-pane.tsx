"use client";

import { useState } from "react";
import { AlarmClock } from "lucide-react";
import { Spinner, ToggleGroup, ToggleGroupItem } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { useAccount, type Account } from "../../../lib/account-context";
import { useToast } from "../../../components/toast-host";
import { BrowserNotificationsSection } from "../../../components/browser-notifications-section";
import { DailyDigestSection } from "../../../components/daily-digest-section";
import { AccountCard, AccountPaneHeader } from "./account-card";
import { useT } from "../../../lib/i18n";

const LEADS = [5, 15, 30, 60] as const;

/**
 * US-SET-30, US-AUTH-19 (D-236) — Settings › Your account › Notifications:
 * browser notifications, the daily digest (naming the business's time zone)
 * and meeting reminders (naming the business's default). Each saves as it
 * changes.
 */
export function AccountNotificationsPane() {
  const t = useT();
  const { account, setAccount } = useAccount();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  if (!account) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  const businessDefault = account.orgDefaults.meetingReminderLeadMinutes;

  async function setLead(value: string) {
    try {
      setAccount(await apiClient.put<Account>("/users/me/meeting-reminder-lead-minutes", { meetingReminderLeadMinutes: value === "" ? null : Number(value) }));
      toast(t("settings.notifications.remindersSaved"), value === "" ? t("settings.notifications.remindedDefault", { minutes: businessDefault }) : t("settings.notifications.reminded", { minutes: value }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.notifications.saveError"));
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="account-notifications">
      <AccountPaneHeader title={t("settings.notifications.title")} description={t("settings.notifications.description")} />
      {error && (
        <p className="text-[13px] text-overdue" role="alert">
          {error}
        </p>
      )}
      <div className="rounded-lg border border-border bg-surface p-5">
        <BrowserNotificationsSection />
      </div>
      <DailyDigestSection
        value={{ digestEnabled: account.digestEnabled, digestTime: account.digestTime, digestDays: account.digestDays }}
        timeZone={account.orgDefaults.timeZone}
        onSaved={(next) => {
          setAccount({ ...account, ...next });
          toast(next.digestEnabled ? t("settings.notifications.digestOn", { days: next.digestDays === "daily" ? t("settings.notifications.everyDay") : t("settings.notifications.weekdays") }) : t("settings.notifications.digestOff"), t("settings.notifications.changeAnyTime"));
        }}
        onError={setError}
      />
      <AccountCard title={t("settings.notifications.remindersTitle")} description={t("settings.notifications.remindersDescription")}>
        <ToggleGroup
          type="single"
          value={account.meetingReminderLeadMinutes === null ? "" : String(account.meetingReminderLeadMinutes)}
          onValueChange={(v) => v !== undefined && void setLead(v)}
          className="w-fit flex-wrap rounded-sm bg-surface-sunken p-0.5"
          aria-label={t("settings.notifications.remindersTitle")}
        >
          <ToggleGroupItem value="" className="h-8 gap-1.5 px-3">
            <AlarmClock size={14} aria-hidden />
            {t("settings.notifications.businessDefault", { minutes: businessDefault })}
          </ToggleGroupItem>
          {LEADS.map((m) => (
            <ToggleGroupItem key={m} value={String(m)} className="h-8 px-3">
              {t("settings.notifications.minutes", { minutes: m })}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </AccountCard>
    </div>
  );
}
