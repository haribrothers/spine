"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Lock, X } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DragHandle,
  FormField,
  Input,
  ReorderableItem,
  ReorderableList,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  cn,
} from "@spine/ui";
import { LEAD_STAGE_NAME_MAX, MAX_LEAD_STAGES, putLeadStagesSchema, type LeadStage, type LeadStageKind } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { STAGE_DOT_CLASS, useLeadStages } from "../../(app)/contacts/use-lead-stages";
import { SavedToast } from "../saved-toast";
import { t, useT } from "../../../lib/i18n";

/** A row being edited: `id` is absent for a stage added in this session. */
interface StageRow {
  key: string;
  id?: string;
  name: string;
  kind: LeadStageKind;
  color?: LeadStage["color"];
  leadCount: number;
}

const KIND_LABEL: Record<LeadStageKind, string> = { open: t("settings.leadStages.kinds.open"), won: t("settings.leadStages.kinds.won"), lost: t("settings.leadStages.kinds.lost") };
const KIND_CLASS: Record<LeadStageKind, string> = { open: "text-on-surface-muted", won: "font-medium text-paid", lost: "font-medium text-overdue" };

function toRows(stages: LeadStage[]): StageRow[] {
  return stages.map((s) => ({ key: s.id, id: s.id, name: s.name, kind: s.kind, color: s.color, leadCount: s.leadCount }));
}

/**
 * US-CRM-19 / US-CRM-20 — Settings › Pipeline stages: rename, reorder,
 * add and delete the columns of the pipeline board. Won and Lost always
 * stay last and can only be renamed. Deleting a stage that still has leads
 * first asks which stage they move to. The whole ordered list, with any
 * moves, is saved at once (`PUT /org/lead-stages`).
 */
export function LeadStagesPane() {
  const t = useT();
  const { stages, error: loadError, setStages } = useLeadStages();
  const [rows, setRows] = useState<StageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  /** Leads of deleted stages wait here until Save: deleted stage id → stage they move to. */
  const [moves, setMoves] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<StageRow | null>(null);
  const [moveTo, setMoveTo] = useState("");

  useEffect(() => {
    if (stages) {
      setRows(toRows(stages));
      setMoves({});
    }
  }, [stages]);

  const open = rows.filter((r) => r.kind === "open");
  const closed = rows.filter((r) => r.kind !== "open");
  const atLimit = rows.length >= MAX_LEAD_STAGES;
  const payload = useMemo(
    () => ({
      stages: rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, color: r.color })),
      moves: Object.entries(moves).map(([fromStageId, toStageId]) => ({ fromStageId, toStageId })),
    }),
    [rows, moves],
  );
  /** Saved stages that can take a deleted stage's leads (a new stage has no id until it's saved). */
  const moveTargets = deleting ? rows.filter((r) => r.id && r.key !== deleting.key) : [];
  const problem = putLeadStagesSchema.safeParse(payload).error?.issues[0]?.message;

  function setOpenOrder(keys: string[]) {
    const byKey = new Map(open.map((r) => [r.key, r]));
    setRows([...keys.map((k) => byKey.get(k)!), ...closed]);
  }

  function moveOpen(key: string, delta: -1 | 1) {
    const keys = open.map((r) => r.key);
    const i = keys.indexOf(key);
    const j = i + delta;
    if (j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j]!, keys[i]!];
    setOpenOrder(keys);
  }

  function rename(key: string, name: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, name } : r)));
  }

  function addStage() {
    if (atLimit) return;
    const key = `new-${crypto.randomUUID()}`;
    setRows([...open, { key, name: t("settings.leadStages.newStage"), kind: "open", leadCount: 0 }, ...closed]);
  }

  function removeRow(row: StageRow, target?: string) {
    setRows((prev) => prev.filter((r) => r.key !== row.key));
    if (row.id && target) {
      const targetRow = rows.find((r) => r.id === target)!;
      setMoves((prev) => {
        // Leads already headed for this stage follow its own leads to the new target.
        const next = Object.fromEntries(Object.entries(prev).map(([from, to]) => [from, to === row.id ? target : to]));
        return { ...next, [row.id!]: target };
      });
      setRows((prev) => prev.map((r) => (r.key === targetRow.key ? { ...r, leadCount: r.leadCount + row.leadCount } : r)));
    }
  }

  function askDelete(row: StageRow) {
    if (row.leadCount === 0) {
      removeRow(row);
      return;
    }
    setMoveTo("");
    setDeleting(row);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (problem) return;
    setSaving(true);
    try {
      const updated = await apiClient.put<LeadStage[]>("/org/lead-stages", payload);
      setStages(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.leadStages.saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <Alert variant="critical">
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }
  if (!stages) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  function renderRow(row: StageRow, index: number, locked: boolean) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="flex w-10 shrink-0 items-center gap-0.5">
          {!locked && (
            <>
              <DragHandle />
              <span className="flex flex-col opacity-0 focus-within:opacity-100">
                <button type="button" aria-label={t("settings.leadStages.moveUp", { name: row.name })} disabled={index === 0} onClick={() => moveOpen(row.key, -1)} className="text-on-surface-muted disabled:opacity-30">
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  aria-label={t("settings.leadStages.moveDown", { name: row.name })}
                  disabled={index === open.length - 1}
                  onClick={() => moveOpen(row.key, 1)}
                  className="text-on-surface-muted disabled:opacity-30"
                >
                  <ArrowDown size={12} />
                </button>
              </span>
            </>
          )}
        </span>
        <span aria-hidden="true" className={cn("h-2.5 w-2.5 shrink-0 rounded-full", row.color ? STAGE_DOT_CLASS[row.color] : "bg-border-strong")} />
        <Input aria-label={t("settings.leadStages.stageName", { kind: KIND_LABEL[row.kind] })} value={row.name} maxLength={LEAD_STAGE_NAME_MAX} onChange={(e) => rename(row.key, e.target.value)} className="flex-1" />
        <span className={cn("w-14 shrink-0 text-[13px]", KIND_CLASS[row.kind])}>{KIND_LABEL[row.kind]}</span>
        <span className="w-16 shrink-0 text-right text-[13px] text-on-surface-muted">
          {t("settings.leadStages.leadCount", { count: row.leadCount })}
        </span>
        <span className="flex w-6 shrink-0 justify-center">
          {!locked && (
            <button
              type="button"
              aria-label={t("settings.leadStages.deleteRow", { name: row.name })}
              onClick={() => askDelete(row)}
              className="rounded-sm text-overdue transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={16} />
            </button>
          )}
          {locked && (
            <span title={t("settings.leadStages.lockedTitle")} className="text-on-surface-muted">
              <Lock size={14} aria-label={t("settings.leadStages.lockedLabel")} />
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSave} noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">{t("settings.leadStages.title")}</h2>
        <p className="text-[13px] text-on-surface-muted">
          {t("settings.leadStages.description")}
        </p>
      </div>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <ReorderableList itemIds={open.map((r) => r.key)} onReorder={setOpenOrder} className="flex flex-col divide-y divide-border">
          {open.map((row, i) => (
            <ReorderableItem key={row.key} id={row.key}>
              {renderRow(row, i, false)}
            </ReorderableItem>
          ))}
        </ReorderableList>
        <div className="flex flex-col divide-y divide-border border-t border-border">
          {closed.map((row, i) => (
            <div key={row.key}>{renderRow(row, i, true)}</div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-start gap-2">
        <Button type="button" variant="secondary" onClick={addStage} disabled={atLimit}>
          {t("settings.leadStages.addStage")}
        </Button>
        <p className="text-[12px] text-on-surface-muted">
          {atLimit ? t("settings.leadStages.limit") : t("settings.leadStages.deleteHint")}
        </p>
        {problem && <p className="text-[13px] text-overdue">{problem}</p>}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving || !!problem}>
          {saving ? <Spinner size="sm" /> : t("settings.common.save")}
        </Button>
      </div>
      <SavedToast open={saved} onOpenChange={setSaved} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.leadStages.deleteConfirm.title", { name: deleting?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.leadStages.deleteConfirm.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FormField label={t("settings.leadStages.deleteConfirm.moveLeads", { count: deleting?.leadCount ?? 0 })}>
            {(field) => (
              <Select value={moveTo} onValueChange={setMoveTo}>
                <SelectTrigger {...field} className="w-full">
                  <SelectValue placeholder={t("settings.leadStages.deleteConfirm.chooseStage")} />
                </SelectTrigger>
                <SelectContent>
                  {moveTargets.map((target) => (
                    <SelectItem key={target.key} value={target.id!}>
                      {target.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("settings.leadStages.deleteConfirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={!moveTo}
              onClick={() => {
                if (deleting && moveTo) removeRow(deleting, moveTo);
                setDeleting(null);
              }}
            >
              {t("settings.leadStages.deleteConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
