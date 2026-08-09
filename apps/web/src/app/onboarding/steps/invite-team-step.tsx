"use client";

import { useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";

// "owner" deliberately excluded — per PRD §2.1, Owner is only granted by
// promoting an existing Staff member (Users page) once they've joined, not
// at invite time. The API rejects role: "owner" on this endpoint too.
export type MemberRole = "staff" | "field";

export interface InviteTeamStepProps {
  onInvite: (email: string, role: MemberRole) => Promise<void>;
  onFinish: () => void;
  /** Hides the bottom "Skip/Finish" footer entirely — Settings has nothing to finish or skip, it just re-fetches the member list after each invite via onInvite. */
  hideFooter?: boolean;
}

/**
 * Team-invite step (S-12.7) — last step, always skippable ("Finish" doubles
 * as skip if nobody's invited). Sends one invite at a time via the API's
 * `/org/invitations` endpoint (a thin wrapper over Better Auth's own
 * organization invitation API — see apps/api/src/modules/org/invitations.controller.ts),
 * so the list of invites sent so far is local UI state, not re-fetched.
 */
export function InviteTeamStep({ onInvite, onFinish, hideFooter = false }: InviteTeamStepProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("staff");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; role: MemberRole }[]>([]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await onInvite(email, role);
      setSent((prev) => [...prev, { email, role }]);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invite.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form className="flex items-end gap-2" onSubmit={handleInvite}>
        <FormField label="Email" className="flex-1">
          {(field) => (
            <Input
              {...field}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              required
            />
          )}
        </FormField>
        <FormField label="Role" className="w-32">
          {() => (
            <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="field">Field</SelectItem>
              </SelectContent>
            </Select>
          )}
        </FormField>
        <Button type="submit" disabled={sending || !email} variant="secondary">
          {sending ? <Spinner size="sm" /> : "Send invite"}
        </Button>
      </form>

      {sent.length > 0 && (
        <ul className="flex flex-col gap-1 text-[13px] text-on-surface-muted">
          {sent.map((invite, i) => (
            <li key={i}>
              Invited <span className="text-on-surface">{invite.email}</span> as {invite.role}
            </li>
          ))}
        </ul>
      )}

      {!hideFooter && (
        <div className="mt-2 flex justify-end">
          <Button onClick={onFinish}>{sent.length > 0 ? "Finish" : "Skip — finish setup"}</Button>
        </div>
      )}
    </div>
  );
}
