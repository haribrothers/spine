"use client";

import { useEffect, useState } from "react";
import { Plug } from "lucide-react";
import { Spinner } from "@spine/ui";
import { AGENTS_MINE_INTRO, agentDisconnectedToast, type AgentConnection, type MyAgentConnections } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useToast } from "../../../components/toast-host";
import { AccountCard, AccountPaneHeader } from "./account-card";
import { ConnectorAddress } from "./agents-pane";
import { AgentConnectionsTable } from "./agent-connections-table";
import { useT } from "../../../lib/i18n";

/**
 * US-MCP-04 (D-258) — Settings › Your account › Connected agents, for
 * everyone while Connected agents is on: the agents this person connected,
 * disconnecting one, and the address to connect another.
 */
export function MyAgentsPane() {
  const t = useT();
  const toast = useToast();
  const [data, setData] = useState<MyAgentConnections | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    apiClient
      .get<MyAgentConnections>("/agents/connections")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : t("settings.myAgents.loadError")));
  useEffect(() => {
    void load();
  }, []);

  async function disconnect(c: AgentConnection) {
    try {
      await apiClient.delete(`/agents/connections/${c.id}`);
      toast(agentDisconnectedToast(c.clientName), t("settings.myAgents.disconnectedDescription"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.myAgents.disconnectError"));
    }
  }

  if (!data) {
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

  return (
    <div className="flex flex-col gap-4" data-testid="my-agents-pane">
      <AccountPaneHeader title={t("settings.myAgents.title")} description={AGENTS_MINE_INTRO} />
      {error && (
        <p role="alert" className="text-[13px] text-overdue">
          {error}
        </p>
      )}
      {data.connections.length ? (
        <AgentConnectionsTable connections={data.connections} onDisconnect={disconnect} />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong px-5 py-8 text-center text-[13px] text-on-surface-muted">
          <span className="grid size-11 place-items-center rounded-xl bg-surface-sunken text-on-surface-muted">
            <Plug size={20} aria-hidden />
          </span>
          <b className="text-[14px] font-semibold text-on-surface">{t("settings.myAgents.emptyTitle")}</b>
          {t("settings.myAgents.emptyBody")}
        </div>
      )}
      <AccountCard title={data.connections.length ? t("settings.myAgents.connectAnother") : t("settings.myAgents.connectorAddress")} description={t("settings.myAgents.connectorDescription")}>
        <ConnectorAddress url={data.mcpUrl} copyLabel={t("settings.myAgents.copyAddress")} />
      </AccountCard>
    </div>
  );
}
