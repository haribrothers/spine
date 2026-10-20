import { AsyncLocalStorage } from "node:async_hooks";

/** US-MCP-07 (D-258) — set for a request an agent's tool made (verified by `AgentRequestMiddleware`), so what it records says "via <Agent>". */
export const agentRequest = new AsyncLocalStorage<{ via: string; connectionId: string }>();
export const currentAgentVia = (): string | null => agentRequest.getStore()?.via ?? null;
