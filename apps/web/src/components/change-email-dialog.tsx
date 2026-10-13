"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input, PasswordInput, Spinner } from "@spine/ui";
import { ApiError, apiClient } from "../lib/api-client";
import type { Account } from "../lib/account-context";

/**
 * US-AUTH-18 (D-236) — a new sign-in email needs the current password; the
 * old address is told. Errors land under the field they're about.
 */
export function ChangeEmailDialog({ open, onOpenChange, onChanged }: { open: boolean; onOpenChange: (open: boolean) => void; onChanged: (account: Account) => void }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ newEmail?: string; currentPassword?: string; other?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNewEmail("");
    setPassword("");
    setErrors({});
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const account = await apiClient.put<Account>("/users/me/email", { newEmail: newEmail.trim(), currentPassword: password });
      onOpenChange(false);
      onChanged(account);
    } catch (err) {
      const field = err instanceof ApiError ? (err.body as { field?: string } | undefined)?.field : undefined;
      const message = err instanceof Error ? err.message : "Couldn't change your email. Try again.";
      setErrors(field === "newEmail" || field === "currentPassword" ? { [field]: message } : { other: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Change your sign-in email</DialogTitle>
            <DialogDescription>You&apos;ll sign in with the new address from now on. We&apos;ll tell your current address it changed.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <FormField label="New email" errorText={errors.newEmail}>
              {(field) => <Input {...field} type="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />}
            </FormField>
            <FormField label="Current password" errorText={errors.currentPassword}>
              {(field) => <PasswordInput {...field} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
            </FormField>
            {errors.other && (
              <p className="text-[13px] text-overdue" role="alert">
                {errors.other}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !newEmail.trim() || !password}>
              {saving ? <Spinner size="sm" /> : null}
              Change email
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
