import { z } from "zod";

/**
 * US-MCP-02 (D-256, D-258) — Settings › Connected agents: the Owner's switch
 * for outside AI agents (Claude, ChatGPT, Claude Code…) and whether they may
 * create drafts. `mcpUrl` is the one address people add as a connector.
 */
export interface AgentsSettings {
  enabled: boolean;
  /** "Agents can create drafts" — off removes the draft tools for everyone. */
  drafts: boolean;
  /** The connector address: the API's public address + `/mcp`. */
  mcpUrl: string;
  /** False when the address isn't https and isn't this machine: Claude and ChatGPT on the web can't reach it. */
  httpsReachable: boolean;
}

export const DEFAULT_AGENTS = { enabled: false, drafts: true } as const;

export const agentsSettingsUpdateSchema = z
  .object({ enabled: z.boolean().optional(), drafts: z.boolean().optional() })
  .strict()
  .refine((v) => v.enabled !== undefined || v.drafts !== undefined, { message: "Choose what to change." });
export type AgentsSettingsUpdate = z.infer<typeof agentsSettingsUpdateSchema>;

/** Whether hosted agents (claude.ai, ChatGPT) can reach this address: https, or this machine (where only local agents connect anyway). */
export function agentsAddressReachable(url: string): boolean {
  const m = /^(https?):\/\/(\[[^\]]+\]|[^/:?#]+)/i.exec(url.trim());
  if (!m) return false;
  return m[1]!.toLowerCase() === "https" || ["localhost", "127.0.0.1", "[::1]"].includes(m[2]!.toLowerCase());
}

export const AGENTS_PANE_INTRO =
  "Let people use Spine from AI agents like Claude and ChatGPT. Each person connects their own agent and approves what it can do. Agents can read and create drafts — they never issue, send, record or delete anything.";
export const AGENTS_TURN_ON_TITLE = "Turn on connected agents?";
export const AGENTS_TURN_ON_MESSAGE = "People will be able to connect AI agents to Spine. An agent sees what the person who connected it can see, and sends it to that agent's AI provider.";
export const AGENTS_TURN_ON_CAN = [
  "Agents can read and, if you allow it, create drafts — leads, quotes, vendor bills and notes.",
  "They can't issue, send, record payments, approve, void, delete or change settings.",
  "They never get more than their person — Field never sees money or reports.",
] as const;
export const AGENTS_TURN_OFF_TITLE = "Turn off connected agents?";
export const AGENTS_TURN_OFF_MESSAGE = "Every connected agent stops working at once. Connections are kept for when you turn this back on.";
export const AGENTS_ON_TOAST = "Connected agents are on";
export const AGENTS_OFF_TOAST = "Connected agents are off";
export const AGENTS_DRAFTS_HINT = "Leads, draft quotes, draft vendor bills and notes, for a person to check and finish in Spine. Off: agents can only read. Agents never issue, send, record payments, approve, void, delete or change settings.";
export const AGENTS_HTTP_WARNING =
  "Claude and ChatGPT on the web can only connect to an https address they can reach from the internet. Agents on this network, like Claude Code, can still connect.";

/** What `/mcp` and the consent page say while the Owner has agents switched off. */
export const agentsOffMessage = (business: string) => `Connected agents are turned off for ${business}. Ask an Owner to turn them on.`;

/** How to add the address in each agent, for the pane. */
export const AGENTS_HOW_TO = [
  { agent: "Claude", how: "Add a custom connector and paste the address. Works on the web, desktop and phone." },
  { agent: "ChatGPT", how: "Add a connector and paste the address. ChatGPT opens Spine to sign in." },
  { agent: "Claude Code", how: "Run claude mcp add --transport http spine with the address." },
] as const;
