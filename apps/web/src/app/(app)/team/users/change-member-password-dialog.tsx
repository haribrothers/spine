"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, LogOut, Mail, MessageCircle, RefreshCw } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  PasswordStrengthMeter,
  Spinner,
} from "@spine/ui";
import { generatePassword, passwordProblem } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { MENU_ICONS } from "../../../../lib/menu-icons";
import type { MemberRow } from "../../../../lib/members";

/**
 * US-TEAM-24 (D-233) — `ChangeMemberPasswordDialog`: an Owner sets a Staff
 * or Field member's password. It starts with a strong suggestion, shown so
 * it can be passed on (Copy, Hide, Generate another, or type one), the
 * strength meter used at sign-up, and what happens: they're signed out
 * everywhere, emailed that it changed (never the password), and choose
 * their own at next sign-in.
 */
export function ChangeMemberPasswordDialog({
  member,
  onOpenChange,
  onChanged,
}: {
  member: MemberRow | null;
  onOpenChange: (open: boolean) => void;
  onChanged: (member: MemberRow) => void;
}) {
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(true);
  const [copied, setCopied] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!member) return;
    setPassword(generatePassword());
    setShown(true);
    setCopied(false);
    setFieldError(undefined);
    setError(null);
  }, [member]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setShown(true);
    }
  }

  async function save() {
    if (!member) return;
    const problem = passwordProblem(password);
    if (problem) {
      setFieldError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.put(`/org/members/${member.id}/password`, { newPassword: password });
      onChanged(member);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change the password. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const first = member?.name.split(" ")[0] ?? "";
  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Change {member?.name}&rsquo;s password</DialogTitle>
          <DialogDescription>Set a new password for {first}. Their current one stops working at once.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField label="New password" errorText={fieldError} required>
            {(field) => (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Input
                    {...field}
                    type={shown ? "text" : "password"}
                    autoComplete="new-password"
                    spellCheck={false}
                    value={password}
                    aria-describedby={[field["aria-describedby"], "member-password-strength"].filter(Boolean).join(" ")}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFieldError(undefined);
                      setCopied(false);
                    }}
                    className="pr-20 font-mono"
                  />
                  <div className="absolute inset-y-0 right-1 flex items-center">
                    <Button type="button" variant="ghost" size="icon" aria-label={copied ? "Password copied" : "Copy password"} onClick={() => void copy()}>
                      <Copy size={15} aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={shown ? "Hide password" : "Show password"} aria-pressed={!shown} onClick={() => setShown((s) => !s)}>
                      {shown ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 text-[12.5px]">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                    onClick={() => {
                      setPassword(generatePassword());
                      setShown(true);
                      setCopied(false);
                      setFieldError(undefined);
                    }}
                  >
                    <RefreshCw size={13} aria-hidden />
                    Generate another
                  </button>
                  <span className="text-on-surface-muted" aria-live="polite">
                    {copied ? "Copied" : shown ? "Shown so you can pass it on" : ""}
                  </span>
                </div>
                <PasswordStrengthMeter id="member-password-strength" password={password} />
              </div>
            )}
          </FormField>
          <div className="rounded-lg border border-due-soon-bg bg-due-soon-bg/50 px-3 py-2.5 text-[13px] text-on-surface" data-testid="password-what-happens">
            <p className="mb-1.5 font-semibold">What happens</p>
            <ul className="flex flex-col gap-1.5">
              <li className="flex items-start gap-2">
                <LogOut size={15} aria-hidden className="mt-0.5 shrink-0 text-on-surface-muted" />
                {first} is signed out on every device, web and phone.
              </li>
              <li className="flex items-start gap-2">
                <Mail size={15} aria-hidden className="mt-0.5 shrink-0 text-on-surface-muted" />
                We email {first} that an owner changed their password — never the password itself.
              </li>
              <li className="flex items-start gap-2">
                <MessageCircle size={15} aria-hidden className="mt-0.5 shrink-0 text-on-surface-muted" />
                Give them the new password yourself, in person or by phone. When they sign in with it, they choose their own.
              </li>
            </ul>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !password}>
            {saving ? <Spinner size="sm" /> : <MENU_ICONS.changePassword size={14} aria-hidden />}
            Change password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
