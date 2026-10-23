import type { Database } from "../../db/client";
import { agentRequests } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import type { AgentContext } from "./mcp-context";

export type AgentRequestOutcome = "ok" | "refused" | "error" | "rate_limited";

const OUTCOME_TEXT: Record<AgentRequestOutcome, string> = { ok: "Worked", refused: "Refused", error: "Didn't work", rate_limited: "Slowed down — over 120 calls a minute" };

/** The audit action for a tool call, read as a sentence: "Searched", "Listed invoices", "Read invoice", "Drafted quote". */
export function agentAction(tool: string, args: Record<string, unknown>): string {
  if (tool === "search") return "searched";
  if (tool === "list_records") return `listed_${String(args.type ?? "record")}s`;
  if (tool === "get_record") return `read_${String(args.type ?? "record")}`;
  if (tool === "create_lead") return "created_lead";
  if (tool === "draft_quote") return "drafted_quote";
  if (tool === "draft_vendor_bill") return "drafted_vendor_bill";
  if (tool === "add_note") return "added_note";
  return `read_${tool}`;
}

/** The record a call touched, when there is one: what it opened, or what it created. */
export function agentRecord(tool: string, args: Record<string, unknown>, structured: Record<string, unknown> | undefined): { type: string; id: string } | null {
  const idOf = (v: unknown) => (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string" ? (v as { id: string }).id : null);
  if (tool === "get_record" && typeof args.type === "string") {
    const id = (typeof args.id === "string" ? args.id : null) ?? idOf(structured);
    return id ? { type: args.type, id } : null;
  }
  if (tool === "draft_quote" && idOf(structured?.quote)) return { type: "quote", id: idOf(structured?.quote)! };
  if (tool === "draft_vendor_bill" && idOf(structured?.bill)) return { type: "vendor_bill", id: idOf(structured?.bill)! };
  if (tool === "create_lead" && idOf(structured?.lead)) return { type: "lead", id: idOf(structured?.lead)! };
  if (tool === "add_note" && typeof args.id === "string" && typeof args.on === "string") return { type: args.on, id: args.id };
  return null;
}

/**
 * US-MCP-08 (D-258) — records one agent tool call: an `agent_requests` row
 * and an audit entry ("Agent request") naming who, the agent, what it did,
 * the record and how it ended — with a refusal's reason in Spine's words,
 * never the arguments' text or the result.
 */
export async function recordAgentRequest(
  db: Database,
  ctx: Pick<AgentContext, "orgId" | "userId" | "connectionId" | "clientName">,
  call: { tool: string; action: string; record: { type: string; id: string } | null; outcome: AgentRequestOutcome; durationMs: number; reason?: string | null },
): Promise<void> {
  const [row] = await db
    .insert(agentRequests)
    .values({ orgId: ctx.orgId, userId: ctx.userId, connectionId: ctx.connectionId, tool: call.tool, entityType: call.record?.type ?? null, entityId: call.record?.id ?? null, outcome: call.outcome, durationMs: call.durationMs })
    .returning({ id: agentRequests.id });
  const outcome = call.outcome === "refused" && call.reason ? `Refused — ${call.reason.slice(0, 140)}` : OUTCOME_TEXT[call.outcome];
  await new AuditLogService(db).record(db, {
    orgId: ctx.orgId,
    actorUserId: ctx.userId,
    action: call.action,
    entityType: "agent_request",
    entityId: row!.id,
    contactId: null,
    via: ctx.clientName,
    changes: { summary: `${ctx.clientName} · ${outcome}`, agent: ctx.clientName, tool: call.tool, outcome: call.outcome, durationMs: call.durationMs },
  });
}
