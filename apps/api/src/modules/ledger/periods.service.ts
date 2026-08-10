import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { createFiscalPeriodSchema } from "@spine/shared";
import { and, asc, eq } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { fiscalPeriods } from "../../db/schema";

export type CreateFiscalPeriodInput = z.infer<typeof createFiscalPeriodSchema>;

/**
 * S-09.8 — "close a period so nobody back-dates entries into it." A closed
 * period blocks `LedgerService.postEntry` from writing any journal entry
 * whose `date` falls within `[startDate, endDate]` (see that method's own
 * guard) — this service only manages the period rows themselves
 * (create/list/close/reopen), never posts anything.
 *
 * Deliberately no overlap-prevention between periods: an owner closing
 * "Q1" and later "Jan-Mar" (overlapping) is a user error, not something
 * this v1 needs to police — the posting guard only cares whether ANY
 * closed period covers a given date, and overlapping closed ranges still
 * produce the correct block either way.
 */
@Injectable()
export class PeriodsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(orgId: string) {
    return this.db.select().from(fiscalPeriods).where(eq(fiscalPeriods.orgId, orgId)).orderBy(asc(fiscalPeriods.startDate));
  }

  async create(orgId: string, input: CreateFiscalPeriodInput) {
    if (input.endDate < input.startDate) {
      throw new BadRequestException("endDate must not be before startDate");
    }
    const [row] = await this.db
      .insert(fiscalPeriods)
      .values({ orgId, startDate: input.startDate, endDate: input.endDate })
      .returning();
    return row;
  }

  async close(orgId: string, id: string) {
    return this.setClosed(orgId, id, true);
  }

  async reopen(orgId: string, id: string) {
    return this.setClosed(orgId, id, false);
  }

  private async setClosed(orgId: string, id: string, isClosed: boolean) {
    const [existing] = await this.db.select().from(fiscalPeriods).where(and(eq(fiscalPeriods.orgId, orgId), eq(fiscalPeriods.id, id)));
    if (!existing) {
      throw new NotFoundException("Fiscal period not found");
    }
    const [row] = await this.db.update(fiscalPeriods).set({ isClosed }).where(eq(fiscalPeriods.id, id)).returning();
    return row;
  }

  /**
   * Returns true if `date` (YYYY-MM-DD) falls within any closed period for
   * this org — the exact check `LedgerService.postEntry` needs. Accepts an
   * open transaction handle so the caller (postEntry) can run this check in
   * the same transaction as the write it's guarding, rather than against
   * `this.db` directly.
   */
  async isDateClosed(dbOrTx: Database | Transaction, orgId: string, date: string): Promise<boolean> {
    const periods = await dbOrTx
      .select()
      .from(fiscalPeriods)
      .where(and(eq(fiscalPeriods.orgId, orgId), eq(fiscalPeriods.isClosed, true)));
    return periods.some((p) => date >= p.startDate && date <= p.endDate);
  }
}
