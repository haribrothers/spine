"use client";

import { useEffect, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import { Plus } from "lucide-react";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { MENU_ICONS } from "../../../../lib/menu-icons";
import type { TeamSummary } from "../../../../lib/teams";

export type TeamDialogMode = { kind: "create"; from?: TeamSummary } | { kind: "rename"; team: TeamSummary };

const NOTHING = "__nothing__";

/**
 * US-TEAM-26 (D-234) — `CreateTeamDialog`: name, an optional description and
 * "Start from" (nothing allowed, or another Team's permissions — never its
 * members). Duplicate opens it with "<Team> (copy)" and that Team chosen;
 * Rename edits the name and description (the default Team keeps its name).
 */
export function TeamDialog({
  mode,
  teams,
  onOpenChange,
  onSaved,
}: {
  mode: TeamDialogMode | null;
  teams: TeamSummary[];
  onOpenChange: (open: boolean) => void;
  onSaved: (team: TeamSummary, mode: TeamDialogMode) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [from, setFrom] = useState(NOTHING);
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mode) return;
    if (mode.kind === "rename") {
      setName(mode.team.name);
      setDescription(mode.team.description ?? "");
    } else {
      setName(mode.from ? `${mode.from.name} (copy)` : "");
      setDescription(mode.from?.description ?? "");
      setFrom(mode.from?.id ?? NOTHING);
    }
    setNameError(undefined);
    setError(null);
  }, [mode]);

  async function save() {
    if (!mode) return;
    if (!name.trim()) {
      setNameError("Give the Team a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = { name: name.trim(), description: description.trim() || null };
      const saved =
        mode.kind === "rename"
          ? await apiClient.put<TeamSummary>(`/org/teams/${mode.team.id}`, mode.team.isDefault ? { description: body.description } : body)
          : await apiClient.post<TeamSummary>("/org/teams", { ...body, ...(from !== NOTHING ? { copyFromTeamId: from } : {}) });
      onSaved(saved, mode);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setNameError(err.message);
      else setError(err instanceof Error ? err.message : "Couldn't save the Team. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const renaming = mode?.kind === "rename";
  const duplicating = mode?.kind === "create" && Boolean(mode.from);
  const title = renaming ? `Rename ${mode.team.name}` : duplicating ? `Duplicate ${mode!.kind === "create" ? mode!.from!.name : ""}` : "Create Team";
  const source = teams.find((t) => t.id === from);
  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {renaming
              ? "Change what the Team is called and what it's for. Its members and permissions stay."
              : duplicating
                ? `A new Team starting with ${mode!.kind === "create" ? mode!.from!.name : ""}'s permissions. Its members aren't copied — add people once it's made.`
                : "A group of Staff with the same permissions. Add people once it's made."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField label="Name" required errorText={nameError} helperText={renaming && mode.team.isDefault ? "The default Team's name can't change." : undefined}>
            {(field) => (
              <Input
                {...field}
                value={name}
                maxLength={100}
                disabled={renaming && mode.team.isDefault}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(undefined);
                }}
                placeholder="e.g. Site supervisors"
                autoFocus
              />
            )}
          </FormField>
          <FormField label="Description" helperText="Optional. What this Team is for — shown on Teams and on its page.">
            {(field) => <Input {...field} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Jobs, crews and site expenses" />}
          </FormField>
          {!renaming && (
            <FormField label="Start from" helperText="You can change what it allows before anyone is on it.">
              {(field) => (
                <Select value={from} onValueChange={setFrom}>
                  <SelectTrigger id={field.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NOTHING}>Nothing allowed</SelectItem>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} — {t.granted.length} permissions
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}
          {!renaming && source && <p className="-mt-2 text-[12.5px] text-on-surface-muted">Copies {source.name}&apos;s permissions only.</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Spinner size="sm" /> : renaming ? <MENU_ICONS.edit size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
            {renaming ? "Save" : "Create Team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
