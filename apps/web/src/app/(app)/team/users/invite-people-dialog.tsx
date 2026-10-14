"use client";

import { useEffect, useMemo, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
  cn,
} from "@spine/ui";
import { MAX_INVITES_AT_ONCE, isEmailAddress, parseEmailList, type InviteMembersResult } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { MENU_ICONS } from "../../../../lib/menu-icons";
import { TeamChecklist, type TeamOption } from "./team-checklist";

/**
 * US-TEAM-21 (D-232) — `InvitePeopleDialog`: several emails at once (commas,
 * spaces or new lines; up to 20), the role and, for Staff, the Teams they
 * join on accepting. What couldn't be invited stays listed, with why.
 */
export function InvitePeopleDialog({
  open,
  onOpenChange,
  teams,
  businessName,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamOption[];
  businessName: string;
  onInvited: (result: InviteMembersResult) => void;
}) {
  const [text, setText] = useState("");
  const [role, setRole] = useState<"staff" | "field">("staff");
  // Until someone ticks or unticks, the default Team — even if the Teams load after it opens.
  const [chosen, setChosen] = useState<string[] | null>(null);
  const teamIds = chosen ?? teams.filter((t) => t.isDefault).map((t) => t.id);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<InviteMembersResult["skipped"]>([]);

  // Reset as it opens only — a refresh of the Teams behind it mustn't clear what's typed.
  useEffect(() => {
    if (!open) return;
    setText("");
    setRole("staff");
    setChosen(null);
    setError(null);
    setSkipped([]);
  }, [open]);

  const emails = useMemo(() => parseEmailList(text), [text]);
  const bad = emails.filter((e) => !isEmailAddress(e));
  const good = emails.length - bad.length;
  const tooMany = emails.length > MAX_INVITES_AT_ONCE;

  async function send() {
    setSending(true);
    setError(null);
    try {
      const result = await apiClient.post<InviteMembersResult>("/org/invitations", { emails, role, ...(role === "staff" ? { teamIds } : {}) });
      onInvited(result);
      if (result.skipped.length === 0) onOpenChange(false);
      else {
        setSkipped(result.skipped);
        setText(result.skipped.map((s) => s.email).join("\n"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the invites. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription>Each gets an email with a link to join {businessName}. Owners are made by promoting Staff, not by invite.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {skipped.length > 0 && (
            <Alert variant="warning" data-testid="invite-skipped">
              <AlertDescription>
                <span className="font-medium">These weren&apos;t invited:</span>
                <ul className="mt-1 list-disc pl-5">
                  {skipped.map((s) => (
                    <li key={s.email}>
                      {s.email} — {s.reason}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <FormField label="Emails" required helperText={`Separate them with commas, spaces or new lines. Up to ${MAX_INVITES_AT_ONCE} at once.`}>
            {(field) => <Textarea id={field.id} value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="sam@example.com, neha@example.com" />}
          </FormField>
          {emails.length > 0 && (
            <div className="-mt-2 flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-1.5" aria-label="Emails to invite">
                {emails.map((email) => (
                  <span key={email} className={cn("rounded-md px-2 py-0.5 text-[12.5px] font-medium", isEmailAddress(email) ? "bg-surface-sunken text-on-surface" : "bg-overdue-bg text-overdue")}>
                    {email}
                  </span>
                ))}
              </div>
              {bad.length > 0 && <p className="text-[12.5px] text-overdue">{bad.length === 1 ? `${bad[0]} isn't an email address — fix or remove it.` : `${bad.length} of these aren't email addresses — fix or remove them.`}</p>}
              {tooMany && <p className="text-[12.5px] text-overdue">That&apos;s more than {MAX_INVITES_AT_ONCE} — send the rest in another batch.</p>}
            </div>
          )}
          <FormField label="Role">
            {(field) => (
              <Select value={role} onValueChange={(v) => setRole(v as "staff" | "field")}>
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="field">Field</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>
          {role === "staff" ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-on-surface">Teams they&apos;ll join</span>
              <TeamChecklist teams={teams} value={teamIds} onChange={setChosen} label="Teams they'll join" />
              <p className="text-[12.5px] text-on-surface-muted">Staff can open what their Teams allow. You can change this later.</p>
            </div>
          ) : (
            <p className="text-[12.5px] text-on-surface-muted">Field see the jobs they&apos;re assigned to, without money, and their own meetings and expenses.</p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {skipped.length > 0 ? "Done" : "Cancel"}
          </Button>
          <Button onClick={() => void send()} disabled={sending || good === 0 || bad.length > 0 || tooMany}>
            {sending ? <Spinner size="sm" /> : <MENU_ICONS.send size={14} aria-hidden />}
            {good === 1 ? "Send invite" : `Send invites (${good})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
