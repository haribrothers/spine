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
import { useT } from "../../../../lib/i18n";
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
  const t = useT();
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
      setName(mode.from ? t("team.teamDialog.copyName", { name: mode.from.name }) : "");
      setDescription(mode.from?.description ?? "");
      setFrom(mode.from?.id ?? NOTHING);
    }
    setNameError(undefined);
    setError(null);
  }, [mode]);

  async function save() {
    if (!mode) return;
    if (!name.trim()) {
      setNameError(t("team.teamDialog.nameRequired"));
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
      else setError(err instanceof Error ? err.message : t("team.teamDialog.failed"));
    } finally {
      setSaving(false);
    }
  }

  const renaming = mode?.kind === "rename";
  const duplicating = mode?.kind === "create" && Boolean(mode.from);
  const title = renaming ? t("team.teamDialog.renameTitle", { name: mode.team.name }) : duplicating ? t("team.teamDialog.duplicateTitle", { name: mode!.kind === "create" ? mode!.from!.name : "" }) : t("team.teamDialog.createTitle");
  const source = teams.find((team) => team.id === from);
  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {renaming
              ? t("team.teamDialog.renameDescription")
              : duplicating
                ? t("team.teamDialog.duplicateDescription", { name: mode!.kind === "create" ? mode!.from!.name : "" })
                : t("team.teamDialog.createDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField label={t("team.teamDialog.name")} required errorText={nameError} helperText={renaming && mode.team.isDefault ? t("team.teamDialog.defaultNameFixed") : undefined}>
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
                placeholder={t("team.teamDialog.namePlaceholder")}
                autoFocus
              />
            )}
          </FormField>
          <FormField label={t("team.teamDialog.description")} helperText={t("team.teamDialog.descriptionHelper")}>
            {(field) => <Input {...field} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder={t("team.teamDialog.descriptionPlaceholder")} />}
          </FormField>
          {!renaming && (
            <FormField label={t("team.teamDialog.startFrom")} helperText={t("team.teamDialog.startFromHelper")}>
              {(field) => (
                <Select value={from} onValueChange={setFrom}>
                  <SelectTrigger id={field.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NOTHING}>{t("team.teamDialog.nothingAllowed")}</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {t("team.teamDialog.teamOption", { name: team.name, n: team.granted.length })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}
          {!renaming && source && <p className="-mt-2 text-[12.5px] text-on-surface-muted">{t("team.teamDialog.copiesOnly", { name: source.name })}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("team.common.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Spinner size="sm" /> : renaming ? <MENU_ICONS.edit size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
            {renaming ? t("team.teamDialog.save") : t("team.teamDialog.createTitle")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
