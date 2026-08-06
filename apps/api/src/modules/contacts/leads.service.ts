import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { createLeadSchema, updateLeadSchema } from "@spine/shared";
import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { leads, type leadStageEnum } from "../../db/schema";

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type LeadStage = (typeof leadStageEnum.enumValues)[number];

/**
 * Leads CRUD. Stage is the fixed enum from db/schema/contacts.ts (see that
 * file's comment on why true per-org configurable stages are deferred).
 * `listByStage` groups results for a simple list/table view filterable by
 * stage — the underlying data model (this grouping, plus `valueAmount`
 * already on each row) is what a future kanban pipeline board would
 * consume directly, per the task brief's explicit scope split.
 */
@Injectable()
export class LeadsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(orgId: string, stage?: LeadStage) {
    const conditions = [eq(leads.orgId, orgId)];
    if (stage) conditions.push(eq(leads.stage, stage));
    return this.db
      .select()
      .from(leads)
      .where(and(...conditions))
      .orderBy(desc(leads.createdAt));
  }

  async listByContact(orgId: string, contactId: string) {
    return this.db
      .select()
      .from(leads)
      .where(and(eq(leads.orgId, orgId), eq(leads.contactId, contactId)))
      .orderBy(desc(leads.createdAt));
  }

  async getOne(orgId: string, id: string) {
    const [lead] = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.orgId, orgId), eq(leads.id, id)));
    if (!lead) {
      throw new NotFoundException("Lead not found");
    }
    return lead;
  }

  async create(orgId: string, input: CreateLeadInput) {
    const [created] = await this.db
      .insert(leads)
      .values({
        orgId,
        contactId: input.contactId,
        stage: input.stage ?? "new",
        valueAmount: input.valueAmount ?? 0n,
        valueCurrency: input.valueCurrency,
        source: input.source ?? null,
        ownerUserId: input.ownerUserId ?? null,
        title: input.title ?? null,
      })
      .returning();
    return created;
  }

  async update(orgId: string, id: string, input: UpdateLeadInput) {
    await this.getOne(orgId, id);
    const [updated] = await this.db
      .update(leads)
      .set({
        ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
        ...(input.stage !== undefined ? { stage: input.stage } : {}),
        ...(input.valueAmount !== undefined ? { valueAmount: input.valueAmount } : {}),
        ...(input.valueCurrency !== undefined ? { valueCurrency: input.valueCurrency } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  async delete(orgId: string, id: string) {
    await this.getOne(orgId, id);
    await this.db.delete(leads).where(eq(leads.id, id));
    return { id };
  }
}
