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

/** "Last active 2 hours ago", "Last active yesterday", "Last active on 12 Oct". */
function lastActive(at: string): string {
  const label = lastActiveLabel(at);
  if (/^(Just now|Yesterday)$/.test(label)) return `Last active ${label.toLowerCase()}`;
  return /ago$/.test(label) ? `Last active ${label}` : `Last active on ${label}`;
}

const deviceIcon = (device: string) => (/iPhone|Android|phone/.test(device) ? Smartphone : /macOS|Windows|Linux|ChromeOS/.test(device) ? Laptop : Monitor);

/**
 * US-AUTH-17 (D-236) — Settings › Your account › Password & security:
 * change the password (signing out other devices unless unticked) and see
 * where the account is signed in, ending one session or all the others.
 */
export function AccountSecurityPane() {
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
      toast(signOutOthers ? "Password changed. Your other devices are signed out." : "Password changed.", "Use it the next time you sign in.");
      load();
    } catch (err) {
      setErrors({ current: err instanceof Error ? err.message : "Couldn't change your password. Check your current password and try again." });
    } finally {
      setSaving(false);
    }
  }

  async function endOne(session: AccountSession) {
    const ok = await confirm({ title: `Sign out ${session.device}?`, description: "It'll need to sign in again.", confirmLabel: "Sign out", danger: true });
    if (!ok) return;
    try {
      await apiClient.delete(`/users/me/sessions/${session.id}`);
      toast(`${session.device} signed out.`, "It needs to sign in again to use Spine.");
    } catch (err) {
      toast("Couldn't sign that device out.", err instanceof Error ? err.message : "Try again.");
    }
    load();
  }

  async function endOthers() {
    const others = (sessions ?? []).filter((s) => !s.current);
    const ok = await confirm({
      title: `Sign out of ${others.length === 1 ? "1 other device" : `${others.length} other devices`}?`,
      description: `${others.map((s) => s.device).join(" and ")} will need to sign in again. You stay signed in here.`,
      confirmLabel: `Sign out ${others.length === 1 ? "1 device" : `${others.length} devices`}`,
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await apiClient.post<{ signedOut: number }>("/users/me/sessions/sign-out-others");
      toast(`Signed out of ${res.signedOut === 1 ? "1 other device" : `${res.signedOut} other devices`}.`, "You're still signed in here.");
    } catch (err) {
      toast("Couldn't sign out your other devices.", err instanceof Error ? err.message : "Try again.");
    }
    load();
  }

  const others = (sessions ?? []).filter((s) => !s.current).length;

  return (
    <div className="flex flex-col gap-4" data-testid="account-security">
      <AccountPaneHeader title="Password & security" description="Change your password and see where your account is signed in." />
      <div className="flex flex-col gap-4">
        <AccountCard title="Change password" description="At least 8 characters. Use one you don't use anywhere else.">
          <form onSubmit={changePassword} className="flex flex-col gap-4">
            <FormField label="Current password" errorText={errors.current}>
              {(field) => <PasswordInput {...field} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />}
            </FormField>
            <FormField label="New password" errorText={errors.next}>
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
            <FormField label="Confirm new password" errorText={errors.again}>
              {(field) => <PasswordInput {...field} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />}
            </FormField>
            <label className="flex items-center gap-2 text-[13px] font-medium text-on-surface">
              <Checkbox checked={signOutOthers} onCheckedChange={(on) => setSignOutOthers(on === true)} aria-label="Sign out of my other devices" />
              Sign out of my other devices
            </label>
            <div>
              <Button type="submit" disabled={saving || !current || !next || !again}>
                {saving ? <Spinner size="sm" /> : null}
                Change password
              </Button>
            </div>
          </form>
        </AccountCard>
        <AccountCard
          title="Where you're signed in"
          description={sessions ? `${sessions.length === 1 ? "1 device" : `${sessions.length} devices`}. Sign out one you don't recognise or no longer use.` : undefined}
          action={
            others > 0 ? (
              <Button variant="secondary" size="sm" onClick={() => void endOthers()}>
                <LogOut size={14} aria-hidden />
                Sign out of other devices
              </Button>
            ) : undefined
          }
        >
          {failed ? (
            <p className="text-[13px] text-on-surface-muted">Couldn&apos;t load your devices. Refresh to try again.</p>
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
                        {s.current && <Badge className="bg-paid-bg text-paid">This device</Badge>}
                      </p>
                      <p className="text-[12.5px] text-on-surface-muted">{[s.ipAddress, s.current ? "Active now" : lastActive(s.lastActiveAt)].filter(Boolean).join(" · ")}</p>
                    </div>
                    {!s.current && (
                      <Button variant="secondary" size="sm" onClick={() => void endOne(s)} aria-label={`Sign out ${s.device}`}>
                        Sign out
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
