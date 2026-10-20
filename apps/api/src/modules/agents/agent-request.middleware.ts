import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { agentConnections } from "../../db/schema";
import { agentRequest } from "./agent-request-context";
import { verifyAgentHeader } from "./agent-session";

/**
 * US-MCP-07 (D-258) — a request an agent's tool made on the person's behalf
 * carries `x-spine-agent`, signed over that request's own session. When it
 * checks out and the connection is live, the request runs knowing the
 * agent's name, so audit entries (and the record's Activity) say "via <Agent>".
 * An unsigned or forged header is ignored.
 */
@Injectable()
export class AgentRequestMiddleware implements NestMiddleware {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const header = req.headers["x-spine-agent"];
    const connectionId = verifyAgentHeader(typeof header === "string" ? header : undefined, req.headers.authorization);
    if (!connectionId) return next();
    const [row] = await this.db
      .select({ name: agentConnections.clientName })
      .from(agentConnections)
      .where(and(eq(agentConnections.id, connectionId), isNull(agentConnections.endedAt)));
    if (!row) return next();
    agentRequest.run({ via: row.name, connectionId }, () => next());
  }
}
