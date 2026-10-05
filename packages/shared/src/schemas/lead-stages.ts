import { z } from "zod";
import { uuidSchema } from "./common.ts";

/**
 * US-CRM-19 / US-CRM-20 (D-062) — an organisation's pipeline stages. Up to
 * 12; exactly one Won and one Lost, always last (Won then Lost), which can
 * be renamed but never deleted or moved. `kind` is what reports read, so a
 * renamed Won still counts as won.
 */
export const leadStageKindSchema = z.enum(["open", "won", "lost"]);
export type LeadStageKind = z.infer<typeof leadStageKindSchema>;

/** Design-token category colours a stage's dot can use (never hex). */
export const LEAD_STAGE_COLORS = ["slate", "blue", "teal", "amber", "purple", "pink", "green", "red"] as const;
export type LeadStageColor = (typeof LEAD_STAGE_COLORS)[number];

export const MAX_LEAD_STAGES = 12;
export const LEAD_STAGE_NAME_MAX = 40;

/** What every organisation starts with (the same rows migration 0063 seeded for existing ones). */
export const DEFAULT_LEAD_STAGES: { name: string; kind: LeadStageKind; color: LeadStageColor }[] = [
  { name: "New", kind: "open", color: "slate" },
  { name: "Qualified", kind: "open", color: "blue" },
  { name: "Proposal", kind: "open", color: "amber" },
  { name: "Won", kind: "won", color: "green" },
  { name: "Lost", kind: "lost", color: "red" },
];

export const leadStageInputSchema = z.object({
  /** Omitted for a new stage. */
  id: uuidSchema.optional(),
  name: z.string().trim().min(1, "Every stage needs a name.").max(LEAD_STAGE_NAME_MAX, `Keep stage names under ${LEAD_STAGE_NAME_MAX} characters.`),
  kind: leadStageKindSchema,
  color: z.enum(LEAD_STAGE_COLORS).optional(),
});

/** Where a deleted stage's leads go (US-CRM-20). */
export const leadStageMoveSchema = z.object({ fromStageId: uuidSchema, toStageId: uuidSchema });

/**
 * `PUT /org/lead-stages` — the whole ordered set replaces the current one.
 * Stages left out are deleted; a deleted stage that still has leads needs a
 * move. The shape rules (count, one Won and one Lost, last) are checked
 * here so the form and the API refuse the same things.
 */
export const putLeadStagesSchema = z
  .object({
    stages: z.array(leadStageInputSchema),
    moves: z.array(leadStageMoveSchema).optional(),
  })
  .superRefine((value, ctx) => {
    const { stages } = value;
    if (stages.length > MAX_LEAD_STAGES) ctx.addIssue({ code: "custom", message: `Up to ${MAX_LEAD_STAGES} stages.`, path: ["stages"] });
    const won = stages.filter((s) => s.kind === "won").length;
    const lost = stages.filter((s) => s.kind === "lost").length;
    if (won !== 1 || lost !== 1) {
      ctx.addIssue({ code: "custom", message: "Keep exactly one Won and one Lost stage.", path: ["stages"] });
      return;
    }
    const n = stages.length;
    if (n < 3 || stages[n - 2]!.kind !== "won" || stages[n - 1]!.kind !== "lost") {
      ctx.addIssue({ code: "custom", message: "Won and Lost stay last, with at least one open stage before them.", path: ["stages"] });
    }
    const names = stages.map((s) => s.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", message: "Give each stage a different name.", path: ["stages"] });
  });

export type PutLeadStagesInput = z.infer<typeof putLeadStagesSchema>;

export interface LeadStage {
  id: string;
  name: string;
  kind: LeadStageKind;
  color: LeadStageColor;
  sortOrder: number;
  /** How many leads are in the stage now. */
  leadCount: number;
}
