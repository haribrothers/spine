import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, inArray, notInArray, sql } from "drizzle-orm";
import {
  AI_BUDGET_USED_ERROR,
  AI_BUDGET_WARNING_MESSAGE,
  AI_FEATURE_KEYS,
  AI_FEATURE_OFF_ERROR,
  AI_NOT_ALLOWED_MESSAGE,
  AI_RATE_LIMIT,
  AI_RATE_LIMIT_ERROR,
  AI_RATE_LIMIT_MESSAGE,
  AI_REQUEST_FEATURE,
  AI_TIMEOUT_ERROR,
  AI_UNAVAILABLE_ERROR,
  AI_UNAVAILABLE_MESSAGE,
  MODULE_OFF_ERROR,
  aiFeatureOffMessage,
  aiPausedMessage,
  moduleOffMessage,
  type AiFeatureKey,
  type AiStatus,
  type AiUsage,
} from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { aiRequests, user } from "../../db/schema";
import { getMemberRole, hasCapability } from "../../auth/capability.util";
import { AuditLogService } from "../audit/audit-log.service";
import { orgClock, orgTimeZone } from "../../common/org-clock";
import { NotificationsService } from "../notifications/notifications.service";
import { SettingsService } from "../org/settings.service";
import { AiSettingsService } from "./ai-settings.service";
import { AiHttp, AiProviderError, createAiDriver, type AiDriver } from "./drivers";

/** Which budget notices this month's Owners have had, so each goes once (US-AI-04). */
export const AI_BUDGET_NOTICES_KEY = "ai_budget_notices";

type Outcome = "ok" | "error" | "timeout" | "budget" | "rate_limited";
type Feature = "read_document" | "draft_email" | "draft_quote_lines" | "bank_suggestions";

export interface AiCall {
  orgId: string;
  userId: string;
  feature: AiFeatureKey;
  /** The record the request is for, when there is one (US-AI-06). */
  entityType?: string;
  entityId?: string;
  /** US-AI-05 (D-167) — set by "Read receipt" once it has checked the expense is the caller's own; Field may use AI for nothing else. */
  fieldOwnReceipt?: boolean;
}

const OUTCOME_TEXT: Record<Outcome, string> = { ok: "Worked", error: "Didn't work", timeout: "Didn't answer in 30 seconds", budget: "Paused — this month's budget is used up", rate_limited: "Too many requests" };

/** What a feature's call returns: its answer, and the tokens the provider counted. */
export interface AiAnswer<T> {
  value: T;
  usage: { input: number; output: number };
}

/** "2026-10" → "2026-11-01". */
function firstOfNextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/**
 * US-AI-03, US-AI-04 (D-165, D-168, D-169) — every AI feature goes through
 * `run()`: AI and the feature must be on, the person under 30 requests in
 * 10 minutes, and the organisation under this month's token budget. The
 * request is recorded (never its text), and Owners hear once a month at 80%
 * and once at 100%. A provider that fails or doesn't answer in 30 seconds
 * becomes "AI didn't answer…" (US-AI-07) — nothing is retried.
 */
@Injectable()
export class AiRequestService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly aiSettings: AiSettingsService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly http: AiHttp,
    private readonly audit: AuditLogService,
  ) {}

  /** US-AI-05 (D-167) — Owners always; Staff with "Use AI features"; Field only to read their own receipt. */
  private async allowed(orgId: string, userId: string): Promise<{ canUse: boolean; canReadOwnReceipt: boolean }> {
    const role = await getMemberRole(this.db, orgId, userId);
    if (role === "owner") return { canUse: true, canReadOwnReceipt: true };
    if (role === "field") return { canUse: false, canReadOwnReceipt: true };
    const canUse = role === "staff" && (await hasCapability(this.db, { orgId, userId }, "ai.use"));
    return { canUse, canReadOwnReceipt: canUse };
  }

  async run<T>(call: AiCall, ask: (driver: AiDriver, model: string) => Promise<AiAnswer<T>>): Promise<T> {
    const saved = await this.aiSettings.get(call.orgId);
    if (!saved.enabled) throw new ForbiddenException({ statusCode: 403, error: MODULE_OFF_ERROR, message: moduleOffMessage("ai") });
    const may = await this.allowed(call.orgId, call.userId);
    if (!may.canUse && !(may.canReadOwnReceipt && call.feature === "readDocuments" && call.fieldOwnReceipt)) throw new ForbiddenException(AI_NOT_ALLOWED_MESSAGE);
    if (!saved.features[call.feature]) throw new ForbiddenException({ statusCode: 403, error: AI_FEATURE_OFF_ERROR, message: aiFeatureOffMessage(call.feature) });
    const provider = (await this.aiSettings.provider(call.orgId))!;
    const base = { orgId: call.orgId, userId: call.userId, feature: AI_REQUEST_FEATURE[call.feature] as Feature, entityType: call.entityType ?? null, entityId: call.entityId ?? null, provider: saved.providerHost ?? saved.driver, model: provider.model ?? "" };

    // D-168: 30 requests in 10 minutes a person; refused ones don't count towards it.
    const since = new Date(Date.now() - AI_RATE_LIMIT.minutes * 60_000);
    const [recent] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(aiRequests)
      .where(and(eq(aiRequests.userId, call.userId), gt(aiRequests.createdAt, since), notInArray(aiRequests.outcome, ["rate_limited", "budget"])));
    if ((recent?.n ?? 0) >= AI_RATE_LIMIT.requests) {
      await this.record(base, "rate_limited");
      throw new HttpException({ statusCode: 429, error: AI_RATE_LIMIT_ERROR, message: AI_RATE_LIMIT_MESSAGE }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const month = orgClock().date.slice(0, 7);
    const used = await this.usedThisMonth(call.orgId, month);
    const budget = saved.monthlyTokenBudget;
    if (budget !== null && used >= budget) {
      await this.record(base, "budget");
      throw new HttpException({ statusCode: 409, error: AI_BUDGET_USED_ERROR, message: aiPausedMessage(firstOfNextMonth(month)) }, HttpStatus.CONFLICT);
    }

    const started = Date.now();
    let answer: AiAnswer<T>;
    try {
      answer = await ask(createAiDriver(this.http, provider), provider.model ?? "");
    } catch (err) {
      if (!(err instanceof AiProviderError)) throw err;
      const timedOut = err.kind === "timeout";
      await this.record(base, timedOut ? "timeout" : "error", { durationMs: Date.now() - started, errorCode: err.reason.slice(0, 200) });
      throw new HttpException(
        { statusCode: timedOut ? 504 : 503, error: timedOut ? AI_TIMEOUT_ERROR : AI_UNAVAILABLE_ERROR, message: AI_UNAVAILABLE_MESSAGE },
        timedOut ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const spent = Math.max(0, answer.usage.input) + Math.max(0, answer.usage.output);
    await this.record(base, "ok", { durationMs: Date.now() - started, inputTokens: answer.usage.input, outputTokens: answer.usage.output });
    if (budget !== null) await this.noticeBudget(call.orgId, month, used, used + spent, budget);
    return answer.value;
  }

  /** `GET /ai/status` — what a member's screens show: whether they may use AI, the features that are on, and whether AI is paused. */
  async status(orgId: string, userId: string): Promise<AiStatus> {
    const saved = await this.aiSettings.get(orgId);
    const month = orgClock().date.slice(0, 7);
    const paused = saved.monthlyTokenBudget !== null && (await this.usedThisMonth(orgId, month)) >= saved.monthlyTokenBudget;
    return { ...(await this.allowed(orgId, userId)), supportsImages: saved.supportsImages, features: saved.features, pausedUntil: paused ? firstOfNextMonth(month) : null };
  }

  /** US-AI-04 — `GET /org/ai/usage?month=` (Owner): tokens, requests, the top features and people. */
  async usage(orgId: string, month = orgClock().date.slice(0, 7)): Promise<AiUsage> {
    const saved = await this.aiSettings.get(orgId);
    const inMonth = sql`to_char(${aiRequests.createdAt} at time zone ${orgTimeZone()}, 'YYYY-MM') = ${month}`;
    const spent = sql<number>`coalesce(sum(${aiRequests.inputTokens} + ${aiRequests.outputTokens}), 0)::bigint`;
    const answered = inArray(aiRequests.outcome, ["ok", "error", "timeout"]);
    const [totals] = await this.db.select({ used: spent, requests: sql<number>`count(*)::int` }).from(aiRequests).where(and(eq(aiRequests.orgId, orgId), inMonth, answered));
    const byFeature = await this.db.select({ feature: aiRequests.feature, tokens: spent }).from(aiRequests).where(and(eq(aiRequests.orgId, orgId), inMonth, answered)).groupBy(aiRequests.feature);
    const byUser = await this.db
      .select({ userId: aiRequests.userId, name: user.name, tokens: spent })
      .from(aiRequests)
      .leftJoin(user, eq(user.id, aiRequests.userId))
      .where(and(eq(aiRequests.orgId, orgId), inMonth, answered))
      .groupBy(aiRequests.userId, user.name);
    const used = Number(totals?.used ?? 0);
    const share = (n: number) => (used ? Math.round((n / used) * 100) : 0);
    const budget = saved.monthlyTokenBudget;
    const current = month === orgClock().date.slice(0, 7);
    return {
      month,
      budget,
      used,
      requests: totals?.requests ?? 0,
      percent: budget ? Math.round((used / budget) * 100) : null,
      byFeature: byFeature
        .map((r) => ({ feature: AI_FEATURE_KEYS.find((k) => AI_REQUEST_FEATURE[k] === r.feature)!, tokens: Number(r.tokens), percent: share(Number(r.tokens)) }))
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 3),
      byUser: byUser
        .filter((r) => r.userId)
        .map((r) => ({ userId: r.userId!, name: r.name ?? "Someone who has left", tokens: Number(r.tokens), percent: share(Number(r.tokens)) }))
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 3),
      pausedUntil: current && budget !== null && used >= budget ? firstOfNextMonth(month) : null,
    };
  }

  private async usedThisMonth(orgId: string, month: string): Promise<number> {
    const [row] = await this.db
      .select({ used: sql<number>`coalesce(sum(${aiRequests.inputTokens} + ${aiRequests.outputTokens}), 0)::bigint` })
      .from(aiRequests)
      .where(and(eq(aiRequests.orgId, orgId), sql`to_char(${aiRequests.createdAt} at time zone ${orgTimeZone()}, 'YYYY-MM') = ${month}`));
    return Number(row?.used ?? 0);
  }

  private async record(
    base: { orgId: string; userId: string; feature: Feature; entityType: string | null; entityId: string | null; provider: string; model: string },
    outcome: Outcome,
    extra: { durationMs?: number; inputTokens?: number; outputTokens?: number; errorCode?: string } = {},
  ) {
    const inputTokens = extra.inputTokens ?? 0;
    const outputTokens = extra.outputTokens ?? 0;
    const [row] = await this.db
      .insert(aiRequests)
      .values({ ...base, outcome, durationMs: extra.durationMs ?? 0, inputTokens, outputTokens, errorCode: extra.errorCode ?? null })
      .returning({ id: aiRequests.id });
    // US-AI-06 (D-169): in the organisation audit log too — who, what, the record, provider, model, tokens, how it ended; never the text.
    const summary = [base.provider, base.model, `${(inputTokens + outputTokens).toLocaleString("en-US")} tokens`, OUTCOME_TEXT[outcome]].filter(Boolean).join(" · ");
    await this.audit.record(this.db, {
      orgId: base.orgId,
      actorUserId: base.userId,
      action: base.feature,
      entityType: "ai_request",
      entityId: row!.id,
      contactId: null,
      changes: { summary, provider: base.provider, model: base.model, inputTokens, outputTokens, outcome },
    });
  }

  /** D-168 — Owners hear once a month when usage crosses 80%, and once when it reaches 100%. */
  private async noticeBudget(orgId: string, month: string, before: number, after: number, budget: number) {
    const notices = (await this.settings.get<{ month?: string; warned?: boolean; reached?: boolean }>(orgId, AI_BUDGET_NOTICES_KEY)) ?? {};
    const sent = notices.month === month ? notices : { month };
    const reached = after >= budget && !sent.reached;
    const warned = !reached && after >= budget * 0.8 && before < budget * 0.8 && !sent.warned;
    if (!reached && !warned) return;
    await this.settings.set(orgId, AI_BUDGET_NOTICES_KEY, { ...sent, month, warned: true, ...(reached ? { reached: true } : {}) });
    const message = reached ? aiPausedMessage(firstOfNextMonth(month)) : AI_BUDGET_WARNING_MESSAGE;
    await this.notifications.notify(orgId, {
      subject: message,
      text: `${message} Change the monthly budget in Settings › AI assistant.`,
      recipientRoles: ["owner"],
      inApp: { type: reached ? "ai_budget_reached" : "ai_budget_warning", message, link: "/dashboard?settings=ai" },
    });
  }
}
