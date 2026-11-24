import { agentsAddressReachable } from "@spine/shared";

/** The connector address people add to their agent: the API's public address + `/mcp` (D-258). */
export function mcpUrl(): string {
  const base = (process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`).replace(/\/+$/, "");
  return `${base}/mcp`;
}

/**
 * OAuth 2.1 and the MCP authorization spec allow plain http only on this same
 * machine, so agents can sign in only when the address is https or localhost.
 * On any other http address Spine still starts; `/mcp` explains instead.
 */
export const mcpAvailable = (): boolean => agentsAddressReachable(mcpUrl());
