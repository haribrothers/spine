import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { accounts } from "../../db/schema";

/**
 * Chart-of-accounts read + rename for the onboarding wizard's CoA-review
 * step. Judgment call (see task brief): `accounts` has no `isHidden`
 * column and adding hide/delete semantics is out of scope for this pass —
 * system accounts are read-only, non-system accounts can be renamed but
 * not hidden or deleted here. Full CoA management (add/hide/delete
 * accounts) is Settings/later-phase territory.
 */
@Injectable()
export class AccountsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async listGroupedByType(orgId: string) {
    const rows = await this.db.select().from(accounts).where(eq(accounts.orgId, orgId));
    const grouped: Record<string, typeof rows> = {
      asset: [],
      liability: [],
      equity: [],
      income: [],
      expense: [],
    };
    for (const row of rows) {
      grouped[row.type]?.push(row);
    }
    for (const type of Object.keys(grouped)) {
      grouped[type]!.sort((a, b) => a.code.localeCompare(b.code));
    }
    return grouped;
  }

  async rename(orgId: string, accountId: string, name: string) {
    const [existing] = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.id, accountId)));

    if (!existing) {
      throw new BadRequestException("Account not found");
    }
    if (existing.isSystem) {
      throw new BadRequestException("System accounts cannot be renamed");
    }

    const [updated] = await this.db
      .update(accounts)
      .set({ name, updatedAt: new Date() })
      .where(eq(accounts.id, accountId))
      .returning();
    return updated;
  }
}
