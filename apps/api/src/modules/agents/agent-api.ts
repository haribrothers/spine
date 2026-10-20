import { createHmac, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { and, eq, gt } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { session as sessionTable } from "../../db/schema";
import { auth } from "../../auth/auth";
import type { AgentContext } from "./mcp-context";
import { agentSessionMarker } from "./agent-session";
import { AgentCallError } from "./agent-call-error";

export { AgentCallError };



/**
 * US-MCP-05 (D-259) — tools call Spine's own API routes as the person who
 * connected the agent: every guard (session, active member, module,
 * capability, section, ownership, Field's rules) runs exactly as for their
 * web requests, so an agent can never see or do more. Calls go to this API
 * process on its own port, in a session of their own per connection (marked
 * `spine-agent/<connection>`; hidden from the person's devices and deleted
 * when the connection ends). `x-spine-agent` names the connection, signed
 * with the auth secret, so what the call records says it came through an agent.
 */
@Injectable()
export class AgentApi {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  async get<T>(ctx: AgentContext, path: string): Promise<T> {
    return this.call<T>(ctx, "GET", path);
  }

  async send<T>(ctx: AgentContext, method: "POST" | "PUT", path: string, body: unknown, idempotencyKey: string): Promise<T> {
    return this.call<T>(ctx, method, path, body, idempotencyKey);
  }

  private async call<T>(ctx: AgentContext, method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const token = await this.sessionToken(ctx);
    const address = this.adapterHost.httpAdapter.getHttpServer().address();
    const port = typeof address === "object" && address ? address.port : Number(process.env.PORT ?? 4000);
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-spine-agent": signAgentHeader(ctx.connectionId, token),
        ...(method === "GET" ? {} : { "Idempotency-Key": idempotencyKey ?? randomUUID() }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const parsed = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      const message = (parsed as { message?: unknown } | null)?.message;
      throw new AgentCallError(res.status, typeof message === "string" ? message : Array.isArray(message) ? String(message[0]) : `Spine refused (${res.status}).`);
    }
    return parsed as T;
  }

  /** The connection's session, made on first use and kept while it's valid. */
  private async sessionToken(ctx: AgentContext): Promise<string> {
    const marker = agentSessionMarker(ctx.connectionId);
    const [live] = await this.db
      .select({ token: sessionTable.token })
      .from(sessionTable)
      .where(and(eq(sessionTable.userId, ctx.userId), eq(sessionTable.userAgent, marker), gt(sessionTable.expiresAt, new Date())))
      .limit(1);
    if (live) return live.token;
    const { internalAdapter } = await auth.$context;
    const created = await internalAdapter.createSession(ctx.userId, false, { userAgent: marker, ipAddress: null, activeOrganizationId: ctx.orgId });
    return created.token;
  }
}

/** `<connection id>.<HMAC>` — only Spine can make one, so a client can't pass its own requests off as an agent's. */
export function signAgentHeader(connectionId: string, sessionToken: string): string {
  const mac = createHmac("sha256", process.env.AUTH_SECRET ?? "").update(`${connectionId}.${sessionToken}`).digest("base64url");
  return `${connectionId}.${mac}`;
}
