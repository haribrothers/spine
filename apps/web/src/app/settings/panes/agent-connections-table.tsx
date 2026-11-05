"use client";

import { Bot, CircleCheck, Eye, FilePlus, Terminal, TriangleAlert, Unplug } from "lucide-react";
import { Button, useConfirm } from "@spine/ui";
import { AGENT_DISCONNECT_MESSAGE, AGENT_SCOPES, agentCanLabel, agentDisconnectTitle, type AgentConnection } from "@spine/shared";
import { lastActiveLabel, shortDate } from "../../(app)/team/users/users-list-state";
import { t, useT } from "../../../lib/i18n";

const ROLE_LABEL = { owner: t("settings.agentConnections.roles.owner"), staff: t("settings.agentConnections.roles.staff"), field: t("settings.agentConnections.roles.field") } as const;

/**
 * US-MCP-04 — connected agents as a list: the agent and the host it signs
 * in from (verified, or "Unverified name"), what it may do, when it was
 * connected and last used, and Disconnect (asks first, D-218). With
 * `showPerson`, the Owner's list also says whose each one is.
 */
export function AgentConnectionsTable({ connections, showPerson = false, onDisconnect }: { connections: AgentConnection[]; showPerson?: boolean; onDisconnect: (c: AgentConnection) => Promise<void> }) {
  const t = useT();
  const { confirm, dialog } = useConfirm();

  async function disconnect(c: AgentConnection) {
    const ok = await confirm({ title: agentDisconnectTitle(c.clientName), description: showPerson && c.user ? t("settings.agentConnections.disconnectPersonTold", { message: AGENT_DISCONNECT_MESSAGE, person: c.user.name }) : t("settings.agentConnections.disconnectReconnect", { message: AGENT_DISCONNECT_MESSAGE, client: c.clientName }), confirmLabel: t("settings.agentConnections.disconnect"), danger: true });
    if (ok) await onDisconnect(c);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border" data-testid="agent-connections">
      <table className="w-full text-left text-[13px] text-on-surface">
        <thead className="bg-surface-sunken text-[12px] font-medium text-on-surface-muted">
          <tr>
            <th className="px-3 py-2.5 font-medium">{t("settings.agentConnections.columns.agent")}</th>
            {showPerson && <th className="px-3 py-2.5 font-medium">{t("settings.agentConnections.columns.person")}</th>}
            <th className="px-3 py-2.5 font-medium">{t("settings.agentConnections.columns.can")}</th>
            {!showPerson && <th className="px-3 py-2.5 font-medium">{t("settings.agentConnections.columns.connected")}</th>}
            <th className="px-3 py-2.5 font-medium">{t("settings.agentConnections.columns.lastUsed")}</th>
            <th className="px-3 py-2.5">
              <span className="sr-only">{t("settings.agentConnections.columns.actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {connections.map((c) => {
            const drafts = c.scopes.includes(AGENT_SCOPES.draft);
            return (
              <tr key={c.id} className="border-t border-border" data-testid="agent-connection">
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2.5">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-md ${c.verified ? "bg-info-bg text-primary" : "bg-surface-sunken text-on-surface-muted"}`}>
                      {c.clientHost.startsWith("localhost") || c.clientHost.startsWith("127.0.0.1") ? <Terminal size={16} aria-hidden /> : <Bot size={16} aria-hidden />}
                    </span>
                    <span className="min-w-0">
                      <b className="block truncate font-semibold">{c.clientName}</b>
                      <small className="flex flex-wrap items-center gap-1.5 text-[12px] text-on-surface-muted">
                        {c.verified ? (
                          <>
                            <CircleCheck size={13} aria-hidden className="text-paid" />
                            {c.clientHost}
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 rounded-full bg-due-soon-bg px-1.5 py-px text-[11px] font-semibold text-due-soon">
                              <TriangleAlert size={11} aria-hidden />
                              {t("settings.agentConnections.unverified")}
                            </span>
                            {c.clientHost}
                          </>
                        )}
                      </small>
                    </span>
                  </span>
                </td>
                {showPerson && (
                  <td className="px-3 py-2.5">
                    {c.user?.name}
                    <small className="block text-[12px] text-on-surface-muted">
                      {c.user ? ROLE_LABEL[c.user.role] : ""}{t("settings.agentConnections.since", { date: shortDate(c.connectedAt) })}
                    </small>
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-medium">
                    {drafts ? <FilePlus size={13} aria-hidden className="text-on-surface-muted" /> : <Eye size={13} aria-hidden className="text-on-surface-muted" />}
                    {agentCanLabel(c.scopes, c.user?.role)}
                  </span>
                </td>
                {!showPerson && <td className="px-3 py-2.5">{shortDate(c.connectedAt)}</td>}
                <td className="px-3 py-2.5">{c.lastUsedAt ? lastActiveLabel(c.lastUsedAt) : t("settings.agentConnections.notUsedYet")}</td>
                <td className="px-3 py-2.5 text-right">
                  <Button variant="secondary" size="sm" onClick={() => void disconnect(c)} aria-label={showPerson && c.user ? t("settings.agentConnections.disconnectLabelPerson", { client: c.clientName, person: c.user.name }) : t("settings.agentConnections.disconnectLabel", { client: c.clientName })}>
                    <Unplug size={14} aria-hidden />
                    {t("settings.agentConnections.disconnect")}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {dialog}
    </div>
  );
}
