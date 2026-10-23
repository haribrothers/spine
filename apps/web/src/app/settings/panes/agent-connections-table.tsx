"use client";

import { Bot, CircleCheck, Eye, FilePlus, Terminal, TriangleAlert, Unplug } from "lucide-react";
import { Button, useConfirm } from "@spine/ui";
import { AGENT_DISCONNECT_MESSAGE, AGENT_SCOPES, agentCanLabel, agentDisconnectTitle, type AgentConnection } from "@spine/shared";
import { lastActiveLabel, shortDate } from "../../(app)/team/users/users-list-state";

const ROLE_LABEL = { owner: "Owner", staff: "Staff", field: "Field" } as const;

/**
 * US-MCP-04 — connected agents as a list: the agent and the host it signs
 * in from (verified, or "Unverified name"), what it may do, when it was
 * connected and last used, and Disconnect (asks first, D-218). With
 * `showPerson`, the Owner's list also says whose each one is.
 */
export function AgentConnectionsTable({ connections, showPerson = false, onDisconnect }: { connections: AgentConnection[]; showPerson?: boolean; onDisconnect: (c: AgentConnection) => Promise<void> }) {
  const { confirm, dialog } = useConfirm();

  async function disconnect(c: AgentConnection) {
    const ok = await confirm({ title: agentDisconnectTitle(c.clientName), description: showPerson && c.user ? `${AGENT_DISCONNECT_MESSAGE} ${c.user.name} is told.` : `${AGENT_DISCONNECT_MESSAGE} To use it again, connect it from ${c.clientName}.`, confirmLabel: "Disconnect", danger: true });
    if (ok) await onDisconnect(c);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border" data-testid="agent-connections">
      <table className="w-full text-left text-[13px] text-on-surface">
        <thead className="bg-surface-sunken text-[12px] font-medium text-on-surface-muted">
          <tr>
            <th className="px-3 py-2.5 font-medium">Agent</th>
            {showPerson && <th className="px-3 py-2.5 font-medium">Person</th>}
            <th className="px-3 py-2.5 font-medium">Can</th>
            {!showPerson && <th className="px-3 py-2.5 font-medium">Connected</th>}
            <th className="px-3 py-2.5 font-medium">Last used</th>
            <th className="px-3 py-2.5">
              <span className="sr-only">Actions</span>
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
                              Unverified name
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
                      {c.user ? ROLE_LABEL[c.user.role] : ""} · since {shortDate(c.connectedAt)}
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
                <td className="px-3 py-2.5">{c.lastUsedAt ? lastActiveLabel(c.lastUsedAt) : "Not used yet"}</td>
                <td className="px-3 py-2.5 text-right">
                  <Button variant="secondary" size="sm" onClick={() => void disconnect(c)} aria-label={`Disconnect ${c.clientName}${showPerson && c.user ? ` (${c.user.name})` : ""}`}>
                    <Unplug size={14} aria-hidden />
                    Disconnect
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
