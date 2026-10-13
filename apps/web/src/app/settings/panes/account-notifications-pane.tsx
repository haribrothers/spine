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

const LEADS = [5, 15, 30, 60] as const;

/**
 * US-SET-30, US-AUTH-19 (D-236) — Settings › Your account › Notifications:
 * browser notifications, the daily digest (naming the business's time zone)
 * and meeting reminders (naming the business's default). Each saves as it
 * changes.
 */
export function AccountNotificationsPane() {
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
      toast("Meeting reminders saved.", value === "" ? `You'll be reminded ${businessDefault} minutes before, the business default.` : `You'll be reminded ${value} minutes before.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your meeting reminders. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="account-notifications">
      <AccountPaneHeader title="Notifications" description="How Spine tells you about what needs you. These are yours; the business's defaults are named where they apply." />
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
          toast(next.digestEnabled ? `Daily digest on: ${next.digestDays === "daily" ? "every day" : "Monday to Friday"}.` : "Daily digest turned off.", "Change it here any time.");
        }}
        onError={setError}
      />
      <AccountCard title="Meeting reminders" description="How long before a meeting you're attending starts we remind you.">
        <ToggleGroup
          type="single"
          value={account.meetingReminderLeadMinutes === null ? "" : String(account.meetingReminderLeadMinutes)}
          onValueChange={(v) => v !== undefined && void setLead(v)}
          className="w-fit flex-wrap rounded-sm bg-surface-sunken p-0.5"
          aria-label="Meeting reminders"
        >
          <ToggleGroupItem value="" className="h-8 gap-1.5 px-3">
            <AlarmClock size={14} aria-hidden />
            Business default · {businessDefault} min
          </ToggleGroupItem>
          {LEADS.map((m) => (
            <ToggleGroupItem key={m} value={String(m)} className="h-8 px-3">
              {m} min
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </AccountCard>
    </div>
  );
}
