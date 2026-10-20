/** Marks the session an agent's calls run in, so it's never listed as a device (US-AUTH-17) and ends with the connection (US-MCP-05). */
export const AGENT_SESSION_PREFIX = "spine-agent/";
export const agentSessionMarker = (connectionId: string) => `${AGENT_SESSION_PREFIX}${connectionId}`;
