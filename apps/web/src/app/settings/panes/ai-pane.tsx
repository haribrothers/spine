"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, PlugZap, ShieldCheck } from "lucide-react";
import { Button, Combobox, FormField, Input, PasswordInput, RadioGroup, RadioGroupItem, Spinner, Switch, useConfirm } from "@spine/ui";
import {
  AI_CONNECT_PROVIDER_FIRST,
  AI_FEATURES,
  AI_NEVER_SENT,
  AI_OFF_TOAST,
  AI_ON_TOAST,
  AI_PANE_INTRO,
  aiAcknowledgeFirst,
  aiConnected,
  aiProviderHost,
  aiProviderReady,
  aiTurnOnMessage,
  isLocalAddress,
  maskedKey,
  type AiProviderCheck,
  type AiSettings,
  type AiSettingsUpdate,
  type AiTestResult,
} from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useModules } from "../../../lib/modules-context";
import { useSettingsSaved } from "../../../lib/settings-dirty";
import { useToast } from "../../../components/toast-host";
import { AccountCard, AccountPaneHeader } from "./account-card";

type Driver = "openai-compatible" | "anthropic";
interface Draft {
  driver: Driver | null;
  baseUrl: string;
  model: string;
  /** A new key; empty keeps the saved one. */
  apiKey: string;
}

const fromSaved = (s: AiSettings): Draft => ({ driver: s.driver === "none" ? null : s.driver, baseUrl: s.baseUrl ?? "", model: s.model ?? "", apiKey: "" });

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
 * key only ever comes back as its last four characters. Owner-only (the
 * pane, and the API).
 */
export function AiPane() {
  const toast = useToast();
  const markSaved = useSettingsSaved();
  const { refresh } = useModules();
  const { confirm, dialog } = useConfirm();
  const [saved, setSaved] = useState<AiSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [replacingKey, setReplacingKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [test, setTest] = useState<AiTestResult | null>(null);
  const [busy, setBusy] = useState<"switch" | "save" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<AiSettings>("/org/ai")
      .then((s) => {
        setSaved(s);
        setDraft(fromSaved(s));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "The AI settings didn't load. Try again."));
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
  const dirty = draft.driver !== savedDraft.driver || draft.baseUrl.trim() !== savedDraft.baseUrl || draft.model.trim() !== savedDraft.model || draft.apiKey.trim() !== "";
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
      if (!(await confirm({ title: "Turn on AI?", description: <>{aiTurnOnMessage(saved!.providerHost!)}<WhatsSent /></>, confirmLabel: "Turn on AI" }))) return;
    }
    if (!on && !(await confirm({ title: "Turn off AI?", description: "AI buttons disappear for everyone. Nothing already saved changes.", confirmLabel: "Turn off AI" }))) return;
    setBusy("switch");
    try {
      await put({ enabled: on, ...(on && !saved!.local ? { acknowledged: true } : {}) });
      refresh();
      if (!dirty) markSaved();
      toast(on ? AI_ON_TOAST : AI_OFF_TOAST, on ? "People with the right to use AI see it in the forms they can work on." : "AI is gone from every screen until it's switched back on.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI wasn't switched. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!draft!.driver) return;
    setError(null);
    setBusy("save");
    const body: AiSettingsUpdate = {
      driver: draft!.driver,
      ...(draft!.driver === "openai-compatible" ? { baseUrl: draft!.baseUrl.trim() || null } : {}),
      model: draft!.model.trim() || null,
      ...(draft!.apiKey.trim() ? { apiKey: draft!.apiKey.trim() } : {}),
    };
    try {
      let next: AiSettings;
      try {
        next = await put(body);
      } catch (err) {
        // D-164: moving a switched-on assistant to a provider outside the local network asks first.
        if (!(err instanceof Error) || !draftHost || err.message !== aiAcknowledgeFirst(draftHost)) throw err;
        if (!(await confirm({ title: "Send AI requests here?", description: <>{aiTurnOnMessage(draftHost)}<WhatsSent /></>, confirmLabel: "Use this provider" }))) return;
        next = await put({ ...body, acknowledged: true });
      }
      setDraft(fromSaved(next));
      setReplacingKey(false);
      markSaved();
      toast("AI provider saved", next.enabled ? "AI requests go to the new provider from now on." : "Switch AI on when you're ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The provider wasn't saved. Try again.");
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
      setTest({ ok: false, model: null, supportsImages: null, models: [], error: err instanceof Error ? err.message : "The test didn't run. Try again." });
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
      ? { ok: true, text: test.model ? aiConnected(test.model, test.supportsImages) : `Connected · ${test.models.length} models — choose one` }
      : { ok: false, text: test.error ?? "Couldn't connect." }
    : !dirty && saved.model && saved.supportsImages !== null
      ? { ok: true, text: aiConnected(saved.model, saved.supportsImages) }
      : null;

  return (
    <div className="flex flex-col gap-4" data-testid="ai-pane">
      <div className="flex items-start gap-4 pr-8">
        <div className="min-w-0 flex-1">
          <AccountPaneHeader title="AI assistant" description={AI_PANE_INTRO} />
        </div>
        <label className="flex shrink-0 items-center gap-2.5 pt-1 text-[13.5px] font-semibold text-on-surface">
          {saved.enabled ? "On" : "Off"}
          <Switch aria-label="AI assistant" checked={saved.enabled} disabled={busy === "switch"} onCheckedChange={(on) => void switchTo(on)} />
        </label>
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-2 text-[13px] text-overdue">
          <CircleAlert size={15} aria-hidden />
          {error}
        </p>
      )}

      <AccountCard
        title="Provider"
        description={
          !draft.driver
            ? "Where AI requests go: a model on your own network, or a service with your own key."
            : draftLocal
              ? "This server is on your own network, so nothing leaves it."
              : draftHost
                ? `Business data goes to ${draftHost} when people use AI features.`
                : "Where AI requests go."
        }
      >
        <div className="flex flex-col gap-4">
          <RadioGroup
            aria-label="Provider"
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
                ["openai-compatible", "Local or OpenAI-compatible", "A model on your own network (Ollama, vLLM) or any OpenAI-compatible service"],
                ["anthropic", "Anthropic Claude", "Claude, with your business's own API key"],
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
            <FormField label="Server address" helperText="For example http://192.168.1.20:11434/v1">
              {(field) => <Input {...field} value={draft.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} placeholder="http://192.168.1.20:11434/v1" inputMode="url" />}
            </FormField>
          )}

          {draft.driver && (
            <FormField label="Model" helperText={`From the models ${draft.driver === "anthropic" ? "Anthropic" : "this server"} lists, or type one.`}>
              {(field) => (
                <Combobox
                  {...field}
                  options={models.map((m) => ({ value: m, label: m }))}
                  value={draft.model}
                  onValueChange={(model) => set({ model })}
                  onFocus={loadModels}
                  onClick={loadModels}
                  placeholder="Choose or type a model"
                  emptyText="Type the model's name."
                  allowCreate
                />
              )}
            </FormField>
          )}

          {draft.driver && !showKeyInput && (
            <FormField label="API key" helperText="Stored encrypted. It's never shown again, logged or exported.">
              {(field) => (
                <div className="flex gap-2">
                  <Input {...field} value={maskedKey(saved.apiKeyHint)} readOnly className="flex-1" />
                  <Button variant="secondary" onClick={() => setReplacingKey(true)}>
                    Replace key
                  </Button>
                </div>
              )}
            </FormField>
          )}
          {showKeyInput && (
            <FormField label={draft.driver === "anthropic" ? "API key" : "API key (optional)"} helperText={draft.driver === "anthropic" ? "Stored encrypted. It's never shown again, logged or exported." : "Only if your server asks for one. Stored encrypted."}>
              {(field) => <PasswordInput {...field} value={draft.apiKey} onChange={(e) => set({ apiKey: e.target.value })} autoComplete="new-password" />}
            </FormField>
          )}

          {draft.driver && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => void runTest()} disabled={busy === "test" || (draft.driver === "openai-compatible" && !draft.baseUrl.trim())}>
                {busy === "test" ? <Spinner size="sm" /> : <PlugZap size={15} aria-hidden />}
                Test connection
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

      <div className="flex items-center justify-end gap-2">
        {dirty && <span className="text-[12.5px] text-on-surface-muted">Unsaved changes</span>}
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
            Discard
          </Button>
        )}
        <Button onClick={() => void save()} disabled={!dirty || busy === "save" || !draft.driver}>
          {busy === "save" ? <Spinner size="sm" /> : "Save"}
        </Button>
      </div>
      {dialog}
    </div>
  );
}
