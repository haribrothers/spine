"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Bot, Plug } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Spinner,
  Switch,
} from "@spine/ui";
import { ALWAYS_ON_NOTE, MODULES, MODULE_KEYS, SWITCH_OFF_REASSURANCE, type AgentsSettings, type AiSettings, type ModuleKey, type ModuleSettings, type ModulesResponse } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useModules } from "../../../lib/modules-context";
import { useOpenSettings } from "../../../components/settings-route";
import { SavedToast } from "../saved-toast";
import { useT } from "../../../lib/i18n";
import { orgLocaleTag } from "../../../lib/money";

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(orgLocaleTag(), { month: "short", day: "numeric", year: "numeric" });

/**
 * US-SET-23 (D-154) — Settings › Modules: switch off what the business
 * doesn't use. Switching one off asks first and says what disappears;
 * nothing is deleted. Owner-only (the pane, and the API).
 */
export function ModulesPane() {
  const t = useT();
  const { refresh } = useModules();
  const [saved, setSaved] = useState<ModulesResponse | null>(null);
  const [draft, setDraft] = useState<ModuleSettings | null>(null);
  const [confirmOff, setConfirmOff] = useState<ModuleKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // US-AI-01 (D-242): the fifth module, switched in its own pane.
  const [ai, setAi] = useState<AiSettings | null>(null);
  // US-MCP-02 (D-256): the sixth, also switched in its own pane.
  const [agents, setAgents] = useState<AgentsSettings | null>(null);
  const openSettings = useOpenSettings(true);

  useEffect(() => {
    apiClient
      .get<AiSettings>("/org/ai")
      .then(setAi)
      .catch(() => setAi(null));
    apiClient
      .get<AgentsSettings>("/org/agents")
      .then(setAgents)
      .catch(() => setAgents(null));
  }, []);

  useEffect(() => {
    apiClient
      .get<ModulesResponse>("/org/modules")
      .then((m) => {
        setSaved(m);
        setDraft({ leadsMeetings: m.leadsMeetings, jobsField: m.jobsField, approvals: m.approvals, recurring: m.recurring });
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("settings.modules.loadError")));
  }, []);

  if (!draft || !saved) {
    return error ? (
      <p role="alert" className="text-[13px] text-overdue">
        {error}
      </p>
    ) : (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const toggle = (key: ModuleKey, on: boolean) => {
    setError(null);
    if (!on) setConfirmOff(key);
    else setDraft({ ...draft, [key]: true });
  };

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiClient.put<ModuleSettings & { notice?: string }>("/org/modules", draft);
      const fresh = await apiClient.get<ModulesResponse>("/org/modules");
      setSaved(fresh);
      if (result.notice) setNotice(result.notice);
      setToast(true);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.modules.saveError"));
      // The field app's users block switching Jobs & field off: the switch stays on.
      setDraft({ ...draft!, jobsField: saved!.jobsField || draft!.jobsField });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">{t("settings.modules.title")}</h2>
        <p className="text-[13px] text-on-surface-muted">{t("settings.modules.description")}</p>
      </div>

      <ul className="flex flex-col gap-3" data-testid="modules-list">
        {MODULE_KEYS.map((key) => {
          const id = `module-${key}`;
          const offSince = !saved[key] && !draft[key] ? saved.offSince?.[key] : undefined;
          return (
            <li key={key} className="flex items-center justify-between gap-4 rounded-md border border-border-strong bg-surface p-4">
              <div className="min-w-0">
                <p id={`${id}-label`} className="text-[14px] font-medium text-on-surface">
                  {MODULES[key].label}
                </p>
                <p id={`${id}-description`} className="text-[13px] text-on-surface-muted">
                  {MODULES[key].description}
                  {offSince && (key === "recurring" ? t("settings.modules.switchedOffPaused", { date: shortDate(offSince) }) : t("settings.modules.switchedOff", { date: shortDate(offSince) }))}
                </p>
              </div>
              <Switch aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`} checked={draft[key]} onCheckedChange={(on) => toggle(key, on)} />
            </li>
          );
        })}
        <li className="flex items-center justify-between gap-4 rounded-md border border-border-strong bg-info-bg/50 p-4" data-testid="module-ai">
          <div className="min-w-0">
            <p id="module-ai-label" className="flex items-center gap-2 text-[14px] font-medium text-on-surface">
              <Bot size={16} aria-hidden className="text-primary" />
              {MODULES.ai.label}
            </p>
            <p className="text-[13px] text-on-surface-muted">{MODULES.ai.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-[12.5px] font-medium text-on-surface-muted">{ai?.enabled ? t("settings.modules.onWithHost", { host: ai.providerHost }) : t("settings.modules.off")}</span>
            <Button variant="secondary" size="sm" aria-describedby="module-ai-label" onClick={() => openSettings("ai")}>
              {t("settings.modules.setUpAi")}
              <ArrowRight size={14} aria-hidden />
            </Button>
          </div>
        </li>
        <li className="flex items-center justify-between gap-4 rounded-md border border-border-strong bg-info-bg/50 p-4" data-testid="module-agents">
          <div className="min-w-0">
            <p id="module-agents-label" className="flex items-center gap-2 text-[14px] font-medium text-on-surface">
              <Plug size={16} aria-hidden className="text-primary" />
              {MODULES.agents.label}
            </p>
            <p className="text-[13px] text-on-surface-muted">{MODULES.agents.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-[12.5px] font-medium text-on-surface-muted">{agents?.enabled ? t("settings.modules.on") : t("settings.modules.off")}</span>
            <Button variant="secondary" size="sm" aria-describedby="module-agents-label" onClick={() => openSettings("agents")}>
              {t("settings.modules.setUpAgents")}
              <ArrowRight size={14} aria-hidden />
            </Button>
          </div>
        </li>
      </ul>
      <p className="text-[13px] text-on-surface-muted">{ALWAYS_ON_NOTE}</p>

      {notice && (
        <p role="status" className="text-[13px] text-on-surface">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-overdue">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Spinner size="sm" /> : t("settings.common.save")}
        </Button>
      </div>
      <SavedToast open={toast} onOpenChange={setToast} />

      <AlertDialog open={confirmOff !== null} onOpenChange={(open) => !open && setConfirmOff(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.modules.switchOffConfirm.title", { module: confirmOff ? MODULES[confirmOff].label.toLowerCase() : "" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmOff && t("settings.modules.switchOffConfirm.disappear", { what: `${MODULES[confirmOff].includes.charAt(0).toUpperCase()}${MODULES[confirmOff].includes.slice(1)}` })}
              {SWITCH_OFF_REASSURANCE}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("settings.modules.switchOffConfirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmOff && setDraft((d) => (d ? { ...d, [confirmOff]: false } : d))}>{t("settings.modules.switchOffConfirm.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
