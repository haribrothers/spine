"use client";

import { useEffect, useState } from "react";
import { Ban, Bot, CircleAlert, CircleCheck, Copy, FilePlus, Link2, Terminal, TriangleAlert } from "lucide-react";
import { Button, Spinner, Switch, useConfirm } from "@spine/ui";
import {
  AGENTS_DRAFTS_HINT,
  AGENTS_HOW_TO,
  AGENTS_HTTP_WARNING,
  AGENTS_OFF_TOAST,
  AGENTS_ON_TOAST,
  AGENTS_PANE_INTRO,
  AGENTS_TURN_OFF_MESSAGE,
  AGENTS_TURN_OFF_TITLE,
  AGENTS_TURN_ON_CAN,
  AGENTS_TURN_ON_MESSAGE,
  AGENTS_TURN_ON_TITLE,
  agentDisconnectedToast,
  type AgentConnection,
  type AgentsSettings,
  type AgentsSettingsUpdate,
} from "@spine/shared";
import { AgentConnectionsTable } from "./agent-connections-table";
import { apiClient } from "../../../lib/api-client";
import { useModules } from "../../../lib/modules-context";
import { useToast } from "../../../components/toast-host";
import { AccountCard, AccountPaneHeader } from "./account-card";
import { useT } from "../../../lib/i18n";

/** What agents can and can't do, for the turn-on confirmation. */
function CanAndCant() {
  return (
    <span className="mt-3 flex flex-col gap-2">
      {AGENTS_TURN_ON_CAN.map((line, i) => (
        <span key={line} className={`flex items-start gap-2 ${i === 0 ? "text-on-surface" : "text-on-surface-muted"}`}>
          {i === 0 ? <CircleCheck size={15} aria-hidden className="mt-0.5 shrink-0 text-paid" /> : <Ban size={15} aria-hidden className="mt-0.5 shrink-0" />}
          {line}
        </span>
      ))}
    </span>
  );
}

/** The address people add as a connector, with Copy. */
export function ConnectorAddress({ url, copyLabel: copyLabelProp }: { url: string; copyLabel?: string }) {
  const t = useT();
  const copyLabel = copyLabelProp ?? t("settings.agents.copy");
  const toast = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast(t("settings.agents.copied"), t("settings.agents.copiedDescription"));
    } catch {
      toast(t("settings.agents.copyError"), t("settings.agents.copyErrorDescription"));
    }
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-border-strong bg-surface-sunken px-3 font-mono text-[13.5px] text-on-surface" data-testid="connector-address">
        <Link2 size={15} aria-hidden className="shrink-0 text-on-surface-muted" />
        <span className="truncate">{url}</span>
      </div>
      <Button variant="secondary" onClick={() => void copy()} aria-label={t("settings.agents.copyAria", { label: copyLabel, url })}>
        <Copy size={15} aria-hidden />
        {copyLabel}
      </Button>
    </div>
  );
}

/**
 * US-MCP-02 (D-256, D-258) — Settings › Connected agents, in the Business
 * group after AI assistant. The switch is the whole of it: off, no agent can
 * connect and every connection is refused. On, it gives the address people
 * add to Claude, ChatGPT or Claude Code, warns when hosted agents can't reach
 * it, and has "Agents can create drafts". Both switches save as they change,
 * and turning on or off asks first. Owner-only (the pane, and the API).
 */
export function AgentsPane() {
  const t = useT();
  const toast = useToast();
  const { refresh } = useModules();
  const { confirm, dialog } = useConfirm();
  const [saved, setSaved] = useState<AgentsSettings | null>(null);
  const [busy, setBusy] = useState<"switch" | "drafts" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // US-MCP-04: every connection in the business.
  const [connections, setConnections] = useState<AgentConnection[] | null>(null);
  const loadConnections = () =>
    apiClient
      .get<AgentConnection[]>("/org/agents/connections")
      .then(setConnections)
      .catch(() => setConnections(null));

  useEffect(() => {
    apiClient
      .get<AgentsSettings>("/org/agents")
      .then(setSaved)
      .catch((err) => setError(err instanceof Error ? err.message : t("settings.agents.loadError")));
    void loadConnections();
  }, []);

  if (!saved) {
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

  async function put(body: AgentsSettingsUpdate) {
    setSaved(await apiClient.put<AgentsSettings>("/org/agents", body));
  }

  async function switchTo(on: boolean) {
    setError(null);
    const ok = on
      ? await confirm({ title: AGENTS_TURN_ON_TITLE, description: <>{AGENTS_TURN_ON_MESSAGE}<CanAndCant /></>, confirmLabel: t("settings.agents.turnOn") })
      : await confirm({ title: AGENTS_TURN_OFF_TITLE, description: AGENTS_TURN_OFF_MESSAGE, confirmLabel: t("settings.agents.turnOff") });
    if (!ok) return;
    setBusy("switch");
    try {
      await put({ enabled: on });
      refresh();
      toast(on ? AGENTS_ON_TOAST : AGENTS_OFF_TOAST, on ? t("settings.agents.onDescription") : t("settings.agents.offDescription"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.agents.switchError"));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(c: AgentConnection) {
    try {
      await apiClient.delete(`/org/agents/connections/${c.id}`);
      toast(agentDisconnectedToast(c.clientName), c.user ? t("settings.agents.personTold", { person: c.user.name }) : t("settings.agents.cantUse"));
      await loadConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.agents.disconnectError"));
    }
  }

  async function switchDrafts(on: boolean) {
    setError(null);
    setBusy("drafts");
    try {
      await put({ drafts: on });
      toast(on ? t("settings.agents.drafts") : t("settings.agents.readOnly"), on ? t("settings.agents.draftsOnDescription") : t("settings.agents.draftsOffDescription"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.agents.draftsError"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="agents-pane">
      <div className="flex items-start gap-4 pr-8">
        <div className="min-w-0 flex-1">
          <AccountPaneHeader title={t("settings.agents.title")} description={AGENTS_PANE_INTRO} />
        </div>
        <label className="flex shrink-0 items-center gap-2.5 pt-1 text-[13.5px] font-semibold text-on-surface">
          {saved.enabled ? t("settings.agents.on") : t("settings.agents.off")}
          <Switch aria-label={t("settings.agents.title")} checked={saved.enabled} disabled={busy === "switch"} onCheckedChange={(on) => void switchTo(on)} />
        </label>
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-2 text-[13px] text-overdue">
          <CircleAlert size={15} aria-hidden />
          {error}
        </p>
      )}

      {!saved.enabled ? (
        <p className="text-[13px] text-on-surface-muted">{t("settings.agents.offNote")}</p>
      ) : (
        <>
          <AccountCard title={t("settings.agents.connectorAddress")} description={t("settings.agents.connectorDescription")}>
            <div className="flex flex-col gap-3">
              <ConnectorAddress url={saved.mcpUrl} />
              {!saved.httpsReachable && (
                <p className="flex items-start gap-2.5 rounded-md border border-due-soon/30 bg-due-soon-bg p-3 text-[13px] text-on-surface" data-testid="agents-http-warning">
                  <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0 text-due-soon" />
                  {AGENTS_HTTP_WARNING}
                </p>
              )}
              <div className="grid gap-2.5 md:grid-cols-3">
                {AGENTS_HOW_TO.map((h) => (
                  <div key={h.agent} className="rounded-md border border-border p-3 text-[12.5px] text-on-surface-muted">
                    <p className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-on-surface">
                      {h.agent === "Claude Code" ? <Terminal size={15} aria-hidden className="text-primary" /> : <Bot size={15} aria-hidden className="text-primary" />}
                      {h.agent}
                    </p>
                    {h.how}
                  </div>
                ))}
              </div>
            </div>
          </AccountCard>

          <section className="rounded-lg border border-border bg-surface p-5" aria-label={t("settings.agents.drafts")}>
            <label className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-info-bg text-primary">
                <FilePlus size={16} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-on-surface">{t("settings.agents.drafts")}</span>
                <span id="agents-drafts-hint" className="mt-0.5 block text-[12.5px] text-on-surface-muted">
                  {AGENTS_DRAFTS_HINT}
                </span>
              </span>
              <Switch aria-label={t("settings.agents.drafts")} aria-describedby="agents-drafts-hint" checked={saved.drafts} disabled={busy === "drafts"} onCheckedChange={(on) => void switchDrafts(on)} />
            </label>
          </section>

          <AccountCard title={t("settings.agents.connections")} description={t("settings.agents.connectionsDescription")}>
            {connections && connections.length > 0 ? (
              <AgentConnectionsTable connections={connections} showPerson onDisconnect={disconnect} />
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong px-5 py-8 text-center text-[13px] text-on-surface-muted" data-testid="agents-none">
                <b className="text-[14px] font-semibold text-on-surface">{t("settings.agents.emptyTitle")}</b>
                {t("settings.agents.emptyBody")}
              </div>
            )}
          </AccountCard>
        </>
      )}
      {dialog}
    </div>
  );
}
