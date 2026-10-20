import { createHmac, timingSafeEqual } from "node:crypto";

/** Marks the session an agent's calls run in, so it's never listed as a device (US-AUTH-17) and ends with the connection (US-MCP-05). */
export const AGENT_SESSION_PREFIX = "spine-agent/";
export const agentSessionMarker = (connectionId: string) => `${AGENT_SESSION_PREFIX}${connectionId}`;

/** `<connection id>.<HMAC>` over the agent session's token — only Spine can make one, so a client can't pass its requests off as an agent's. */
export function signAgentHeader(connectionId: string, sessionToken: string): string {
  const mac = createHmac("sha256", process.env.AUTH_SECRET ?? "").update(`${connectionId}.${sessionToken}`).digest("base64url");
  return `${connectionId}.${mac}`;
}

/** The connection a request's `x-spine-agent` header names, when it was signed for this request's own session. */
export function verifyAgentHeader(header: string | undefined, authorization: string | undefined): string | null {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const connectionId = header?.split(".")[0];
  if (!header || !token || !connectionId) return null;
  const expected = Buffer.from(signAgentHeader(connectionId, token));
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given) ? connectionId : null;
}
