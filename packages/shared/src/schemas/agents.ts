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
  /** False when the address isn't https and isn't this machine: no agent can sign in to it (OAuth 2.1 allows http only on localhost). */
  httpsReachable: boolean;
}

export const DEFAULT_AGENTS = { enabled: false, drafts: true } as const;

export const agentsSettingsUpdateSchema = z
  .object({ enabled: z.boolean().optional(), drafts: z.boolean().optional() })
  .strict()
  .refine((v) => v.enabled !== undefined || v.drafts !== undefined, { message: "Choose what to change." });
export type AgentsSettingsUpdate = z.infer<typeof agentsSettingsUpdateSchema>;

/** Whether agents can sign in at this address: https, or this machine (OAuth 2.1 and MCP allow http only on localhost). */
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
/** OAuth 2.1 and MCP allow http only on the same machine (D-258 as built). */
export const AGENTS_HTTP_WARNING =
  "Agents can only connect to Spine over https, or from this same computer at localhost. Give Spine an https address to connect Claude, ChatGPT or Claude Code from anywhere else.";

/** What `/mcp` and the consent page say while the Owner has agents switched off. */
export const agentsOffMessage = (business: string) => `Connected agents are turned off for ${business}. Ask an Owner to turn them on.`;

/** How to add the address in each agent, for the pane. */
export const AGENTS_HOW_TO = [
  { agent: "Claude", how: "Add a custom connector and paste the address. Works on the web, desktop and phone." },
  { agent: "ChatGPT", how: "Add a connector and paste the address. ChatGPT opens Spine to sign in." },
  { agent: "Claude Code", how: "Run claude mcp add --transport http spine with the address." },
] as const;

/** US-MCP-03 (D-258) — what a connection may do. `spine:draft` is the "Create drafts" box on the consent page. */
export const AGENT_SCOPES = { read: "spine:read", draft: "spine:draft" } as const;
export type AgentScope = (typeof AGENT_SCOPES)[keyof typeof AGENT_SCOPES];
/** Every scope the authorization server knows: Spine's two, and OIDC's own for clients that ask. */
export const AGENT_SUPPORTED_SCOPES = ["openid", "profile", "email", "offline_access", AGENT_SCOPES.read, AGENT_SCOPES.draft] as const;

/** What `/mcp` says when Spine's address can't take agents (http, not localhost). */
export const AGENTS_NEED_HTTPS = "Spine needs an https address before agents can connect. Ask whoever runs your Spine server to set one up.";

/** Why a connection ended (`agent_connections.ended_reason`). */
export const AGENT_CONNECTION_ENDS = ["disconnected", "owner", "deactivated", "removed", "password_reset", "idle"] as const;
export type AgentConnectionEnd = (typeof AGENT_CONNECTION_ENDS)[number];

/** US-MCP-03 — the agent on the consent and sign-in pages. A self-registered (DCR) agent's name is only what it claims. */
export interface AgentIdentity {
  name: string;
  /** The host its sign-in returns to (CIMD: its own address). */
  host: string;
  verified: boolean;
}

/** `GET /agent-consent?<signed query>` — what the consent page shows, for the signed-in person. */
export interface AgentConsentInfo {
  /** Connected agents switched off: the page says so instead. */
  off: boolean;
  business: string;
  agent: AgentIdentity;
  person: { name: string; role: "owner" | "staff" | "field"; image: string | null };
  /** Whether the "Create drafts" box shows: the agent asked for drafts and the Owner allows them. */
  draftsOffered: boolean;
}

/** What the consent page lists, by role (Field never hears of money or reports). */
export function consentLines(role: AgentConsentInfo["person"]["role"], agent: AgentIdentity) {
  const field = role === "field";
  return {
    read: field ? "Read your assigned jobs, contacts and the catalogue" : "Read what you can see in Spine — contacts, quotes, jobs, invoices, bills and the reports you can open",
    draftLabel: field ? "Add notes to your jobs" : "Create drafts for you to check",
    draftHint: field ? `Notes show on the job with “via ${agent.host}”.` : "Leads, quotes, vendor bills and notes. You issue or send them yourself in Spine.",
    cant: field ? "It can't see money or reports, and can't issue, send, record or delete anything." : "It can't issue, send, record payments, delete or change settings.",
    sends: agent.verified
      ? `What it reads is sent to ${agent.name}'s AI provider. You can disconnect it any time in Settings › Your account › Connected agents.`
      : `Only allow it if you added ${agent.host} yourself. What it reads is sent to that agent's AI provider.`,
    title: `${agent.verified ? agent.name : agent.host} wants to use Spine as you`,
  };
}

/** The sign-in page's line when an agent sent the person there. */
export const agentSignInNote = (agent: AgentIdentity) => `${agent.verified ? agent.name : agent.host}${agent.verified ? ` (${agent.host})` : ""} is asking to connect to Spine. Log in to choose what it can do.`;

/** US-MCP-04 — a live connection, as the lists show it. */
export interface AgentConnection {
  id: string;
  clientName: string;
  clientHost: string;
  verified: boolean;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
  /** On the Owner's list: whose it is. */
  user?: { id: string; name: string; role: "owner" | "staff" | "field" };
}

/** `GET /agents/connections` — the person's own, and the address to add another. */
export interface MyAgentConnections {
  mcpUrl: string;
  connections: AgentConnection[];
}

/** A connection unused this long ends; the agent has to connect again (D-258). */
export const AGENT_IDLE_DAYS = 30;

/** "Read and create drafts" / "Read" / "Read and add job notes", for the lists. */
export function agentCanLabel(scopes: readonly string[], role?: "owner" | "staff" | "field"): string {
  if (!scopes.includes(AGENT_SCOPES.draft)) return "Read";
  return role === "field" ? "Read and add job notes" : "Read and create drafts";
}

export const AGENTS_MINE_INTRO = "AI agents you've connected to Spine. Each one works as you, with what you're allowed to do — nothing more.";
export const agentDisconnectedToast = (agent: string) => `${agent} disconnected`;
export const agentDisconnectTitle = (agent: string) => `Disconnect ${agent}?`;
export const AGENT_DISCONNECT_MESSAGE = "It stops working at once. Drafts it created stay, marked with its name.";
export const agentDisconnectedByOwner = (owner: string, agent: string) => `${owner} disconnected ${agent} from your account.`;
