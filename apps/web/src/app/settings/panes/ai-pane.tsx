"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, CircleAlert, CircleCheck, Landmark, ListPlus, Mail, PlugZap, ScanText, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button, Combobox, FormField, Input, PasswordInput, Progress, RadioGroup, RadioGroupItem, Spinner, Switch, useConfirm } from "@spine/ui";
import {
  AI_CONNECT_PROVIDER_FIRST,
  AI_FEATURES,
  AI_NEEDS_IMAGES,
  AI_NEVER_SENT,
  AI_OFF_TOAST,
  AI_ON_TOAST,
  AI_PANE_INTRO,
  aiAcknowledgeFirst,
  aiConnected,
  aiProviderHost,
  aiProviderReady,
  aiPausedMessage,
  aiTurnOnMessage,
  isLocalAddress,
  maskedKey,
  type AiFeatureKey,
  type AiProviderCheck,
  type AiSettings,
  type AiSettingsUpdate,
  type AiTestResult,
  type AiUsage,
} from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useModules } from "../../../lib/modules-context";
import { useSettingsSaved } from "../../../lib/settings-dirty";
import { useToast } from "../../../components/toast-host";
import { AccountCard, AccountPaneHeader } from "./account-card";
import { useT } from "../../../lib/i18n";
import { orgLocaleTag } from "../../../lib/money";

type Driver = "openai-compatible" | "anthropic";
interface Draft {
  driver: Driver | null;
  baseUrl: string;
  model: string;
  /** A new key; empty keeps the saved one. */
  apiKey: string;
  /** US-AI-04 — tokens a month as typed; empty for no limit. */
  budget: string;
}

const fromSaved = (s: AiSettings): Draft => ({ driver: s.driver === "none" ? null : s.driver, baseUrl: s.baseUrl ?? "", model: s.model ?? "", apiKey: "", budget: s.monthlyTokenBudget === null ? "" : String(s.monthlyTokenBudget) });
const FEATURE_ICON: Record<AiFeatureKey, typeof Mail> = { readDocuments: ScanText, draftEmails: Mail, draftQuoteLines: ListPlus, bankSuggestions: Landmark };
const fmt = (n: number) => n.toLocaleString(orgLocaleTag());
/** A sample address, not copy. */
const SAMPLE_SERVER_URL = "http://192.168.1.20:11434/v1";
/** "2,000,000" → 2000000; "" → null; anything else → NaN. */
const parseBudget = (text: string): number | null => (text.trim() === "" ? null : /^[\d,\s]+$/.test(text.trim()) ? Number(text.replace(/[,\s]/g, "")) : NaN);

/** What each feature sends, for the turn-on confirmation (D-164, D-165). */
function WhatsSent() {
  return (
    <span className="mt-3 flex flex-col gap-1.5 rounded-md bg-surface-sunken p-3 text-[12.5px] text-on-surface">
      {AI_FEATURES.map((f) => (
        <span key={f.key}>
          <b className="font-semibold">{f.label}:</b> {f.sends}
        </span>
      ))}
      <span className="mt-1 flex items-start gap-1.5 text-on-surface-muted">
        <ShieldCheck size={14} aria-hidden className="mt-0.5 shrink-0" />
        {AI_NEVER_SENT}
      </span>
    </span>
  );
}

/**
 * US-AI-01, US-AI-02 (D-162–D-164, D-242) — Settings › AI assistant, in the
 * Business group. The switch is the whole of AI; it needs a provider, and a
 * provider outside the local network needs the Owner to confirm what's sent.
 * The provider is a model on the business's own network or any
 * OpenAI-compatible service, or Anthropic with the business's own key; the
 * key only ever comes back as its last four characters. With AI on, each
 * feature has its own switch and says what it sends (US-AI-03), and a
 * monthly token budget shows this month's usage (US-AI-04). Owner-only (the
 * pane, and the API).
 */
export function AiPane() {
  const t = useT();
  const toast = useToast();
  const markSaved = useSettingsSaved();
  const { refresh } = useModules();
  const { confirm, dialog } = useConfirm();
  const [saved, setSaved] = useState<AiSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [replacingKey, setReplacingKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [test, setTest] = useState<AiTestResult | null>(null);
  const [busy, setBusy] = useState<"switch" | "save" | "test" | AiFeatureKey | null>(null);
  const [openSent, setOpenSent] = useState<AiFeatureKey | null>(null);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<AiSettings>("/org/ai")
      .then((s) => {
        setSaved(s);
        setDraft(fromSaved(s));
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("settings.ai.loadError")));
    apiClient
      .get<AiUsage>("/org/ai/usage")
      .then(setUsage)
      .catch(() => setUsage(null));
  }, []);

  if (!saved || !draft) {
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

  const set = (patch: Partial<Draft>) => {
    setDraft({ ...draft, ...patch });
    setTest(null);
  };
  const savedDraft = fromSaved(saved);
  const providerDirty = draft.driver !== savedDraft.driver || draft.baseUrl.trim() !== savedDraft.baseUrl || draft.model.trim() !== savedDraft.model || draft.apiKey.trim() !== "";
  const budgetDirty = draft.budget.trim() !== savedDraft.budget;
  const dirty = providerDirty || budgetDirty;
  const showKeyInput = draft.driver !== null && (replacingKey || draft.driver !== saved.driver || !saved.apiKeyHint);
  const draftHost = draft.driver ? aiProviderHost(draft.driver, draft.baseUrl.trim()) : null;
  const draftLocal = draft.driver === "openai-compatible" && isLocalAddress(draft.baseUrl.trim());

  const check = (): AiProviderCheck | null => {
    if (!draft.driver) return null;
    return {
      driver: draft.driver,
      ...(draft.driver === "openai-compatible" ? { baseUrl: draft.baseUrl.trim() || null } : {}),
      model: draft.model.trim() || null,
      ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}),
    };
  };

  async function put(body: AiSettingsUpdate): Promise<AiSettings> {
    const next = await apiClient.put<AiSettings>("/org/ai", body);
    setSaved(next);
    return next;
  }

  async function switchTo(on: boolean) {
    setError(null);
    if (on && !aiProviderReady(saved!)) {
      setError(AI_CONNECT_PROVIDER_FIRST);
      return;
    }
    if (on && !saved!.local) {
      if (!(await confirm({ title: t("settings.ai.turnOnConfirm.title"), description: <>{aiTurnOnMessage(saved!.providerHost!)}<WhatsSent /></>, confirmLabel: t("settings.ai.turnOnConfirm.confirm") }))) return;
    }
    if (!on && !(await confirm({ title: t("settings.ai.turnOffConfirm.title"), description: t("settings.ai.turnOffConfirm.description"), confirmLabel: t("settings.ai.turnOffConfirm.confirm") }))) return;
    setBusy("switch");
    try {
      await put({ enabled: on, ...(on && !saved!.local ? { acknowledged: true } : {}) });
      refresh();
      if (!dirty) markSaved();
      toast(on ? AI_ON_TOAST : AI_OFF_TOAST, on ? t("settings.ai.onDescription") : t("settings.ai.offDescription"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.ai.switchError"));
    } finally {
      setBusy(null);
    }
  }

  async function switchFeature(key: AiFeatureKey, on: boolean) {
    setError(null);
    setBusy(key);
    try {
      await put({ features: { [key]: on } });
      if (!dirty) markSaved();
      const label = AI_FEATURES.find((f) => f.key === key)!.label;
      toast(on ? t("settings.ai.featureOn", { label }) : t("settings.ai.featureOff", { label }), on ? t("settings.ai.featureOnDescription") : t("settings.ai.featureOffDescription"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.ai.featureError"));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!draft!.driver) return;
    setError(null);
    const budget = parseBudget(draft!.budget);
    if (Number.isNaN(budget)) {
      setError(t("settings.ai.budgetInvalid"));
      return;
    }
    setBusy("save");
    const body: AiSettingsUpdate = {
      ...(providerDirty
        ? {
            driver: draft!.driver,
            ...(draft!.driver === "openai-compatible" ? { baseUrl: draft!.baseUrl.trim() || null } : {}),
            model: draft!.model.trim() || null,
            ...(draft!.apiKey.trim() ? { apiKey: draft!.apiKey.trim() } : {}),
          }
        : {}),
      ...(budgetDirty ? { monthlyTokenBudget: budget } : {}),
    };
    try {
      let next: AiSettings;
      try {
        next = await put(body);
      } catch (err) {
        // D-164: moving a switched-on assistant to a provider outside the local network asks first.
        if (!(err instanceof Error) || !draftHost || err.message !== aiAcknowledgeFirst(draftHost)) throw err;
        if (!(await confirm({ title: t("settings.ai.moveConfirm.title"), description: <>{aiTurnOnMessage(draftHost)}<WhatsSent /></>, confirmLabel: t("settings.ai.moveConfirm.confirm") }))) return;
        next = await put({ ...body, acknowledged: true });
      }
      setDraft(fromSaved(next));
      setReplacingKey(false);
      markSaved();
      if (providerDirty) toast(t("settings.ai.providerSaved"), next.enabled ? t("settings.ai.providerSavedOn") : t("settings.ai.providerSavedOff"));
      else toast(t("settings.ai.budgetSaved"), next.monthlyTokenBudget === null ? t("settings.ai.budgetNone") : t("settings.ai.budgetPauses", { tokens: fmt(next.monthlyTokenBudget) }));
      if (budgetDirty) apiClient.get<AiUsage>("/org/ai/usage").then(setUsage).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.ai.saveError"));
    } finally {
      setBusy(null);
    }
  }

  async function runTest() {
    const body = check();
    if (!body) return;
    setError(null);
    setBusy("test");
    try {
      const result = await apiClient.post<AiTestResult>("/org/ai/test", body);
      setTest(result);
      if (result.models.length) setModels(result.models);
    } catch (err) {
      setTest({ ok: false, model: null, supportsImages: null, models: [], error: err instanceof Error ? err.message : t("settings.ai.testError") });
    } finally {
      setBusy(null);
    }
  }

  function loadModels() {
    const body = check();
    if (!body || models.length) return;
    apiClient
      .post<{ models: string[] }>("/org/ai/models", body)
      .then((r) => setModels(r.models))
      .catch(() => {});
  }

  const status: { ok: boolean; text: string } | null = test
    ? test.ok
      ? { ok: true, text: test.model ? aiConnected(test.model, test.supportsImages) : t("settings.ai.connectedModels", { models: test.models.length }) }
      : { ok: false, text: test.error ?? t("settings.ai.couldNotConnect") }
    : !dirty && saved.model && saved.supportsImages !== null
      ? { ok: true, text: aiConnected(saved.model, saved.supportsImages) }
      : null;

  return (
    <div className="flex flex-col gap-4" data-testid="ai-pane">
      <div className="flex items-start gap-4 pr-8">
        <div className="min-w-0 flex-1">
          <AccountPaneHeader title={t("settings.ai.title")} description={AI_PANE_INTRO} />
        </div>
        <label className="flex shrink-0 items-center gap-2.5 pt-1 text-[13.5px] font-semibold text-on-surface">
          {saved.enabled ? t("settings.ai.on") : t("settings.ai.off")}
          <Switch aria-label={t("settings.ai.title")} checked={saved.enabled} disabled={busy === "switch"} onCheckedChange={(on) => void switchTo(on)} />
        </label>
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-2 text-[13px] text-overdue">
          <CircleAlert size={15} aria-hidden />
          {error}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
      <AccountCard
        title={t("settings.ai.provider")}
        description={
          !draft.driver
            ? t("settings.ai.providerNone")
            : draftLocal
              ? t("settings.ai.providerLocal")
              : draftHost
                ? t("settings.ai.providerHost", { host: draftHost })
                : t("settings.ai.providerUnknown")
        }
      >
        <div className="flex flex-col gap-4">
          <RadioGroup
            aria-label={t("settings.ai.provider")}
            value={draft.driver ?? ""}
            onValueChange={(v) => {
              set({ driver: v as Driver, baseUrl: v === saved.driver ? savedDraft.baseUrl : "", model: v === saved.driver ? savedDraft.model : "", apiKey: "" });
              setModels([]);
              setReplacingKey(false);
            }}
            className="grid gap-2.5 md:grid-cols-2"
          >
            {(
              [
                // eslint-disable-next-line i18next/no-literal-string -- a driver id, not copy
                ["openai-compatible", t("settings.ai.drivers.openai.label"), t("settings.ai.drivers.openai.hint")],
                // eslint-disable-next-line i18next/no-literal-string -- a driver id, not copy
                ["anthropic", t("settings.ai.drivers.anthropic.label"), t("settings.ai.drivers.anthropic.hint")],
              ] as const
            ).map(([value, label, hint]) => (
              <label key={value} className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-info-bg">
                <RadioGroupItem value={value} aria-label={label} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-on-surface">{label}</span>
                  <span className="block text-[12.5px] text-on-surface-muted">{hint}</span>
                </span>
              </label>
            ))}
          </RadioGroup>

          {draft.driver === "openai-compatible" && (
            <FormField label={t("settings.ai.serverAddress")} helperText={t("settings.ai.serverAddressHelp", { url: SAMPLE_SERVER_URL })}>
              {(field) => <Input {...field} value={draft.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} placeholder={SAMPLE_SERVER_URL} inputMode="url" />}
            </FormField>
          )}

          {draft.driver && (
            <FormField label={t("settings.ai.model")} helperText={draft.driver === "anthropic" ? t("settings.ai.modelHelpAnthropic") : t("settings.ai.modelHelpServer")}>
              {(field) => (
                <Combobox
                  {...field}
                  options={models.map((m) => ({ value: m, label: m }))}
                  value={draft.model}
                  onValueChange={(model) => set({ model })}
                  onFocus={loadModels}
                  onClick={loadModels}
                  placeholder={t("settings.ai.modelPlaceholder")}
                  emptyText={t("settings.ai.modelEmpty")}
                  allowCreate
                />
              )}
            </FormField>
          )}

          {draft.driver && !showKeyInput && (
            <FormField label={t("settings.ai.apiKey")} helperText={t("settings.ai.apiKeyHelp")}>
              {(field) => (
                <div className="flex gap-2">
                  <Input {...field} value={maskedKey(saved.apiKeyHint)} readOnly className="flex-1" />
                  <Button variant="secondary" onClick={() => setReplacingKey(true)}>
                    {t("settings.ai.replaceKey")}
                  </Button>
                </div>
              )}
            </FormField>
          )}
          {showKeyInput && (
            <FormField label={draft.driver === "anthropic" ? t("settings.ai.apiKey") : t("settings.ai.apiKeyOptional")} helperText={draft.driver === "anthropic" ? t("settings.ai.apiKeyHelp") : t("settings.ai.apiKeyOptionalHelp")}>
              {(field) => <PasswordInput {...field} value={draft.apiKey} onChange={(e) => set({ apiKey: e.target.value })} autoComplete="new-password" />}
            </FormField>
          )}

          {draft.driver && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => void runTest()} disabled={busy === "test" || (draft.driver === "openai-compatible" && !draft.baseUrl.trim())}>
                {busy === "test" ? <Spinner size="sm" /> : <PlugZap size={15} aria-hidden />}
                {t("settings.ai.testConnection")}
              </Button>
              {status && (
                <span role="status" data-testid="ai-connection" className={`flex items-center gap-1.5 text-[13px] font-medium ${status.ok ? "text-on-surface" : "text-overdue"}`}>
                  {status.ok ? <CircleCheck size={15} aria-hidden className="text-paid" /> : <CircleAlert size={15} aria-hidden />}
                  {status.text}
                </span>
              )}
            </div>
          )}
        </div>
      </AccountCard>
      {saved.enabled && (
        <AccountCard title={t("settings.ai.features")} description={t("settings.ai.featuresDescription")}>
          <ul className="flex flex-col" data-testid="ai-features">
            {AI_FEATURES.map((f) => {
              const Icon = FEATURE_ICON[f.key];
              const id = `ai-feature-${f.key}`;
              return (
                <li key={f.key} className="flex items-start gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-info-bg text-primary" aria-hidden>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p id={`${id}-label`} className="text-[13.5px] font-semibold text-on-surface">
                      {f.label}
                    </p>
                    <p className="text-[12.5px] text-on-surface-muted">{f.where}</p>
                    {f.key === "readDocuments" && saved.supportsImages === false && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-due-soon">
                        <TriangleAlert size={14} aria-hidden />
                        {AI_NEEDS_IMAGES}
                      </p>
                    )}
                    <button
                      type="button"
                      className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary"
                      aria-expanded={openSent === f.key}
                      aria-controls={`${id}-sent`}
                      onClick={() => setOpenSent(openSent === f.key ? null : f.key)}
                    >
                      {t("settings.ai.whatsSent")}
                      {openSent === f.key ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
                    </button>
                    {openSent === f.key && (
                      <div id={`${id}-sent`} className="mt-2 rounded-md bg-surface-sunken p-3 text-[12.5px] text-on-surface">
                        <b className="font-semibold">{t("settings.ai.sent")}</b> {f.sends}
                        <p className="mt-1.5 flex items-start gap-1.5 text-on-surface-muted">
                          <ShieldCheck size={14} aria-hidden className="mt-0.5 shrink-0" />
                          {AI_NEVER_SENT}
                        </p>
                      </div>
                    )}
                  </div>
                  <Switch aria-labelledby={`${id}-label`} checked={saved.features[f.key]} disabled={busy === f.key} onCheckedChange={(on) => void switchFeature(f.key, on)} />
                </li>
              );
            })}
          </ul>
        </AccountCard>
      )}
      </div>

      {saved.enabled && (
        <AccountCard title={t("settings.ai.budget")} description={t("settings.ai.budgetDescription")}>
          <div className="grid gap-5 md:grid-cols-[200px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]" data-testid="ai-budget">
            <FormField label={t("settings.ai.tokensAMonth")} helperText={t("settings.ai.tokensAMonthHelp")}>
              {(field) => <Input {...field} value={draft.budget} onChange={(e) => set({ budget: e.target.value })} inputMode="numeric" placeholder={t("settings.ai.noLimit")} />}
            </FormField>
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-semibold text-on-surface-muted">{t("settings.ai.thisMonth")}</p>
              {usage ? (
                <>
                  <p className="flex items-baseline justify-between gap-2 text-[13px] text-on-surface-muted" data-testid="ai-usage">
                    <span>
                      <b className="text-[15px] font-semibold text-on-surface">{fmt(usage.used)}</b>
                      {usage.budget !== null ? t("settings.ai.usageOf", { budget: fmt(usage.budget), percent: usage.percent }) : t("settings.ai.usageTokens")}
                    </span>
                    <span>{t("settings.ai.requests", { count: usage.requests, formatted: fmt(usage.requests) })}</span>
                  </p>
                  {usage.budget !== null && <Progress value={usage.percent ?? 0} aria-label={t("settings.ai.budgetUsed", { percent: usage.percent })} />}
                  {usage.pausedUntil && (
                    <p role="status" className="flex items-center gap-1.5 text-[12.5px] font-medium text-overdue">
                      <CircleAlert size={14} aria-hidden />
                      {aiPausedMessage(usage.pausedUntil)}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-on-surface-muted">{t("settings.ai.noRequests")}</p>
              )}
            </div>
            {(
              [
                [t("settings.ai.topFeatures"), (usage?.byFeature ?? []).map((r) => ({ key: r.feature, name: AI_FEATURES.find((f) => f.key === r.feature)!.label, percent: r.percent }))],
                [t("settings.ai.topPeople"), (usage?.byUser ?? []).map((r) => ({ key: r.userId, name: r.name, percent: r.percent }))],
              ] as const
            ).map(([title, rows]) => (
              <div key={title} className="flex flex-col gap-1.5">
                <p className="text-[12px] font-semibold text-on-surface-muted">{title}</p>
                {rows.length === 0 ? (
                  <p className="text-[12.5px] text-on-surface-muted">{t("settings.ai.noneYet")}</p>
                ) : (
                  rows.map((r) => (
                    <p key={r.key} className="flex justify-between gap-2 text-[12.5px] text-on-surface tabular-nums">
                      <span className="truncate">{r.name}</span>
                      <span>{r.percent}%</span>
                    </p>
                  ))
                )}
              </div>
            ))}
          </div>
        </AccountCard>
      )}

      <div className="flex items-center justify-end gap-2">
        {dirty && <span className="text-[12.5px] text-on-surface-muted">{t("settings.ai.unsaved")}</span>}
        {dirty && (
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(savedDraft);
              setReplacingKey(false);
              setTest(null);
              markSaved();
            }}
          >
            {t("settings.ai.discard")}
          </Button>
        )}
        <Button onClick={() => void save()} disabled={!dirty || busy === "save" || !draft.driver}>
          {busy === "save" ? <Spinner size="sm" /> : t("settings.common.save")}
        </Button>
      </div>
      {dialog}
    </div>
  );
}
