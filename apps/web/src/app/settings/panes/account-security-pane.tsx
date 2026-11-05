"use client";

import { useCallback, useEffect, useState } from "react";
import { Laptop, LogOut, Monitor, Smartphone } from "lucide-react";
import { Badge, Button, Checkbox, FormField, PasswordInput, PasswordStrengthMeter, Spinner, useConfirm } from "@spine/ui";
import { PASSWORDS_DONT_MATCH_MESSAGE, passwordProblem, type AccountSession } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useToast } from "../../../components/toast-host";
import { useSettingsSaved } from "../../../lib/settings-dirty";
import { lastActiveLabel } from "../../(app)/team/users/users-list-state";
import { AccountCard, AccountPaneHeader } from "./account-card";
import { t, useT } from "../../../lib/i18n";

/** "Last active 2 hours ago", "Last active yesterday", "Last active on 12 Oct". */
function lastActive(at: string): string {
  const label = lastActiveLabel(at);
  if (/^(Just now|Yesterday)$/.test(label)) return t("settings.security.lastActive", { label: label.toLowerCase() });
  return /ago$/.test(label) ? t("settings.security.lastActive", { label }) : t("settings.security.lastActiveOn", { label });
}

const deviceIcon = (device: string) => (/iPhone|Android|phone/.test(device) ? Smartphone : /macOS|Windows|Linux|ChromeOS/.test(device) ? Laptop : Monitor);

/**
 * US-AUTH-17 (D-236) — Settings › Your account › Password & security:
 * change the password (signing out other devices unless unticked) and see
 * where the account is signed in, ending one session or all the others.
 */
export function AccountSecurityPane() {
  const t = useT();
  const toast = useToast();
  const markSaved = useSettingsSaved();
  const { confirm, dialog } = useConfirm();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [errors, setErrors] = useState<{ current?: string; next?: string; again?: string }>({});
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    apiClient
      .get<AccountSession[]>("/users/me/sessions")
      .then((rows) => {
        setSessions(rows);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    // US-AUTH-15: the same rules as sign-up, reset and the server.
    const problem = passwordProblem(next);
    const mismatch = next !== again;
    setErrors({ next: problem ?? undefined, again: mismatch ? PASSWORDS_DONT_MATCH_MESSAGE : undefined });
    if (problem || mismatch) return;
    setSaving(true);
    try {
      await apiClient.put("/users/me/password", { currentPassword: current, newPassword: next, signOutOthers });
      setCurrent("");
      setNext("");
      setAgain("");
      markSaved();
      toast(signOutOthers ? t("settings.security.changedSignedOut") : t("settings.security.changed"), t("settings.security.changedDescription"));
      load();
    } catch (err) {
      setErrors({ current: err instanceof Error ? err.message : t("settings.security.changeError") });
    } finally {
      setSaving(false);
    }
  }

  async function endOne(session: AccountSession) {
    const ok = await confirm({ title: t("settings.security.endOneConfirm.title", { device: session.device }), description: t("settings.security.endOneConfirm.description"), confirmLabel: t("settings.security.signOut"), danger: true });
    if (!ok) return;
    try {
      await apiClient.delete(`/users/me/sessions/${session.id}`);
      toast(t("settings.security.endOneDone", { device: session.device }), t("settings.security.endOneDoneDescription"));
    } catch (err) {
      toast(t("settings.security.endOneError"), err instanceof Error ? err.message : t("settings.security.tryAgain"));
    }
    load();
  }

  async function endOthers() {
    const others = (sessions ?? []).filter((s) => !s.current);
    const ok = await confirm({
      title: t("settings.security.endOthersConfirm.title", { count: others.length }),
      description: t("settings.security.endOthersConfirm.description", { devices: others.map((s) => s.device).join(t("settings.security.listJoin")) }),
      confirmLabel: t("settings.security.endOthersConfirm.confirm", { count: others.length }),
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await apiClient.post<{ signedOut: number }>("/users/me/sessions/sign-out-others");
      toast(t("settings.security.endOthersDone", { count: res.signedOut }), t("settings.security.endOthersDoneDescription"));
    } catch (err) {
      toast(t("settings.security.endOthersError"), err instanceof Error ? err.message : t("settings.security.tryAgain"));
    }
    load();
  }

  const others = (sessions ?? []).filter((s) => !s.current).length;

  return (
    <div className="flex flex-col gap-4" data-testid="account-security">
      <AccountPaneHeader title={t("settings.security.title")} description={t("settings.security.description")} />
      <div className="flex flex-col gap-4">
        <AccountCard title={t("settings.security.changePassword")} description={t("settings.security.changePasswordDescription")}>
          <form onSubmit={changePassword} className="flex flex-col gap-4">
            <FormField label={t("settings.security.currentPassword")} errorText={errors.current}>
              {(field) => <PasswordInput {...field} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />}
            </FormField>
            <FormField label={t("settings.security.newPassword")} errorText={errors.next}>
              {(field) => (
                <div className="flex flex-col gap-2">
                  <PasswordInput
                    {...field}
                    aria-describedby={[field["aria-describedby"], "account-password-strength"].filter(Boolean).join(" ")}
                    autoComplete="new-password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    required
                  />
                  <PasswordStrengthMeter id="account-password-strength" password={next} />
                </div>
              )}
            </FormField>
            <FormField label={t("settings.security.confirmPassword")} errorText={errors.again}>
              {(field) => <PasswordInput {...field} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />}
            </FormField>
            <label className="flex items-center gap-2 text-[13px] font-medium text-on-surface">
              <Checkbox checked={signOutOthers} onCheckedChange={(on) => setSignOutOthers(on === true)} aria-label={t("settings.security.signOutOthersOption")} />
              {t("settings.security.signOutOthersOption")}
            </label>
            <div>
              <Button type="submit" disabled={saving || !current || !next || !again}>
                {saving ? <Spinner size="sm" /> : null}
                {t("settings.security.changePassword")}
              </Button>
            </div>
          </form>
        </AccountCard>
        <AccountCard
          title={t("settings.security.sessionsTitle")}
          description={sessions ? t("settings.security.sessionsDescription", { count: sessions.length }) : undefined}
          action={
            others > 0 ? (
              <Button variant="secondary" size="sm" onClick={() => void endOthers()}>
                <LogOut size={14} aria-hidden />
                {t("settings.security.signOutOthersButton")}
              </Button>
            ) : undefined
          }
        >
          {failed ? (
            <p className="text-[13px] text-on-surface-muted">{t("settings.security.loadError")}</p>
          ) : !sessions ? (
            <Spinner />
          ) : (
            <ul className="flex flex-col divide-y divide-border" data-testid="account-sessions">
              {sessions.map((s) => {
                const Icon = deviceIcon(s.device);
                return (
                  <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-on-surface-muted">
                      <Icon size={17} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-on-surface">
                        {s.device}
                        {s.current && <Badge className="bg-paid-bg text-paid">{t("settings.security.thisDevice")}</Badge>}
                      </p>
                      <p className="text-[12.5px] text-on-surface-muted">{[s.ipAddress, s.current ? t("settings.security.activeNow") : lastActive(s.lastActiveAt)].filter(Boolean).join(" · ")}</p>
                    </div>
                    {!s.current && (
                      <Button variant="secondary" size="sm" onClick={() => void endOne(s)} aria-label={t("settings.security.signOutDevice", { device: s.device })}>
                        {t("settings.security.signOut")}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </AccountCard>
      </div>
      {dialog}
    </div>
  );
}
