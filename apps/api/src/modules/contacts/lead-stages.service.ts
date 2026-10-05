import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { DEFAULT_LEAD_STAGES, LEAD_STAGE_COLORS, type LeadStage, type LeadStageColor, type PutLeadStagesInput } from "@spine/shared";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { leads, leadStages } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";

type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * US-CRM-19 / US-CRM-20 (D-062) — an organisation's pipeline stages.
 * Reads are open to every member (the board needs them); replacing the set
 * is Owner-only (the controller). Won and Lost are fixed: they keep their
 * kind and their place at the end, and can be renamed but never removed.
 */
@Injectable()
export class LeadStagesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Seeds the five default stages for an organisation that has none (new sign-ups; orgs made outside sign-up, e.g. tests). */
  async ensureSeeded(orgId: string, executor: Executor = this.db): Promise<void> {
    // One seeder per org at a time; a second caller sees the rows the first wrote.
    await executor.execute(sql`select pg_advisory_xact_lock(hashtext(${`lead_stages:${orgId}`}))`);
    const [existing] = await executor.select({ n: count() }).from(leadStages).where(eq(leadStages.orgId, orgId));
    if ((existing?.n ?? 0) > 0) return;
    await executor.insert(leadStages).values(DEFAULT_LEAD_STAGES.map((s, i) => ({ orgId, name: s.name, kind: s.kind, color: s.color, sortOrder: i })));
  }

  /** The stages in board order, each with its current lead count. */
  async list(orgId: string): Promise<LeadStage[]> {
    await this.db.transaction((tx) => this.ensureSeeded(orgId, tx));
    const rows = await this.db
      .select({
        id: leadStages.id,
        name: leadStages.name,
        kind: leadStages.kind,
        color: leadStages.color,
        sortOrder: leadStages.sortOrder,
        // Qualified by hand: drizzle prints the outer column unqualified, which inside the subquery would bind to leads.id.
        leadCount: sql<number>`(select count(*)::int from "leads" where "leads"."stage_id" = "lead_stages"."id")`,
      })
      .from(leadStages)
      .where(eq(leadStages.orgId, orgId))
      .orderBy(asc(leadStages.sortOrder));
    return rows.map((r) => ({ ...r, color: r.color as LeadStageColor, leadCount: Number(r.leadCount) }));
  }

  /** The stage a lead goes into when none is chosen: the first open stage. */
  async defaultStageId(orgId: string, executor: Executor = this.db): Promise<string> {
    await this.ensureSeeded(orgId, executor);
    const [first] = await executor
      .select({ id: leadStages.id })
      .from(leadStages)
      .where(and(eq(leadStages.orgId, orgId), eq(leadStages.kind, "open")))
      .orderBy(asc(leadStages.sortOrder))
      .limit(1);
    return first!.id;
  }

  /** Refuses a stage id that isn't one of this organisation's stages. */
  async requireStage(orgId: string, stageId: string, executor: Executor = this.db): Promise<void> {
    const [row] = await executor.select({ id: leadStages.id }).from(leadStages).where(and(eq(leadStages.orgId, orgId), eq(leadStages.id, stageId)));
    if (!row) throw new BadRequestException("Choose one of your pipeline stages.");
  }

  /**
   * Replaces the ordered set. New stages (no id) are added; stages left out
   * are deleted — refused while they still have leads unless `moves` says
   * where those leads go (US-CRM-20). Shape rules are in `putLeadStagesSchema`.
   */
  async replace(orgId: string, actorUserId: string, input: PutLeadStagesInput): Promise<LeadStage[]> {
    await this.db.transaction(async (tx) => {
      await this.ensureSeeded(orgId, tx);
      const existing = await tx.select().from(leadStages).where(eq(leadStages.orgId, orgId)).for("update");
      const byId = new Map(existing.map((s) => [s.id, s]));

      for (const stage of input.stages) {
        if (!stage.id) {
          if (stage.kind !== "open") throw new BadRequestException("New stages are open stages; Won and Lost already exist.");
          continue;
        }
        const current = byId.get(stage.id);
        if (!current) throw new BadRequestException("A stage in the list isn't one of your pipeline stages. Reload and try again.");
        if (current.kind !== stage.kind) throw new BadRequestException("A stage's kind can't change — rename it instead.");
      }

      const keptIds = new Set(input.stages.flatMap((s) => (s.id ? [s.id] : [])));
      const removed = existing.filter((s) => !keptIds.has(s.id));
      if (removed.some((s) => s.kind !== "open")) throw new BadRequestException("Won and Lost can't be deleted — rename them instead.");

      const moves = new Map((input.moves ?? []).map((m) => [m.fromStageId, m.toStageId]));
      const removedIds = removed.map((s) => s.id);
      const counts = removedIds.length
        ? await tx.select({ stageId: leads.stageId, n: count() }).from(leads).where(inArray(leads.stageId, removedIds)).groupBy(leads.stageId)
        : [];
      for (const { stageId, n } of counts) {
        const target = moves.get(stageId);
        const name = byId.get(stageId)!.name;
        if (!target) throw new BadRequestException(`"${name}" still has ${n} ${n === 1 ? "lead" : "leads"}. Choose a stage to move ${n === 1 ? "it" : "them"} to first.`);
        if (!keptIds.has(target)) throw new BadRequestException(`Move "${name}"'s leads to a stage you're keeping.`);
        await tx.update(leads).set({ stageId: target, updatedAt: new Date() }).where(and(eq(leads.orgId, orgId), eq(leads.stageId, stageId)));
      }
      const audit = (entityId: string, action: "created" | "updated" | "deleted", changes: { field: string; from: unknown; to: unknown }[]) =>
        this.auditLog.record(tx, { orgId, actorUserId, action, entityType: "lead_stage", entityId, contactId: null, changes });

      for (const stage of removed) await audit(stage.id, "deleted", [{ field: "name", from: stage.name, to: null }]);
      if (removedIds.length) await tx.delete(leadStages).where(inArray(leadStages.id, removedIds));

      const used = new Set(input.stages.flatMap((s) => (s.color ? [s.color] : s.id ? [byId.get(s.id)!.color] : [])));
      for (const [index, stage] of input.stages.entries()) {
        const name = stage.name.trim();
        if (stage.id) {
          const current = byId.get(stage.id)!;
          const color = stage.color ?? current.color;
          await tx.update(leadStages).set({ name, sortOrder: index, color, updatedAt: new Date() }).where(eq(leadStages.id, stage.id));
          const changes = [
            ...(current.name !== name ? [{ field: "name", from: current.name, to: name }] : []),
            ...(current.sortOrder !== index ? [{ field: "position", from: current.sortOrder + 1, to: index + 1 }] : []),
          ];
          if (changes.length) await audit(stage.id, "updated", changes);
        } else {
          const color = stage.color ?? LEAD_STAGE_COLORS.find((c) => !used.has(c) && c !== "green" && c !== "red") ?? "slate";
          used.add(color);
          const [created] = await tx.insert(leadStages).values({ orgId, name, kind: "open", color, sortOrder: index }).returning({ id: leadStages.id });
          await audit(created!.id, "created", [{ field: "name", from: null, to: name }]);
        }
      }
    });
    return this.list(orgId);
  }
}
