import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AgentScope } from "@spine/shared";

/** Who an MCP call runs as: the person who connected the agent, in their organisation (D-256). */
export interface AgentContext {
  orgId: string;
  userId: string;
  role: "owner" | "staff" | "field";
  /** What the connection may do (`spine:read`, `spine:draft`); never widens the person's rights. */
  scopes: ReadonlySet<AgentScope>;
  connectionId: string;
  clientId: string;
  clientName: string;
}

/** Adds the tools (and prompts) this person may use to a fresh per-request server (US-MCP-05 onwards). */
export interface AgentToolRegistrar {
  register(server: McpServer, ctx: AgentContext): void | Promise<void>;
}
