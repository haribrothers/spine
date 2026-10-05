import { DEFAULT_LEAD_STAGES } from "@spine/shared";
import type { Database } from "../client";
import { leadStages } from "../schema";

/**
 * US-CRM-19 — every new organisation starts with New / Qualified /
 * Proposal / Won / Lost, the same rows migration 0063 gave existing ones.
 * LeadStagesService.ensureSeeded covers organisations created any other way.
 */
export async function seedLeadStages(db: Database, orgId: string): Promise<void> {
  await db.insert(leadStages).values(DEFAULT_LEAD_STAGES.map((s, i) => ({ orgId, name: s.name, kind: s.kind, color: s.color, sortOrder: i })));
}
