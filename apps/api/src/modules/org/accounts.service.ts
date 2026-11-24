import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import type { createAccountSchema } from "@spine/shared";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { accounts } from "../../db/schema";

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

/**
 * Chart-of-accounts read, rename, and create. Judgment call (see task
 * brief): `accounts` has no `isHidden` column and adding hide/delete
 * semantics is out of scope for this pass — system accounts are read-only,
 * non-system accounts can be renamed but not hidden or deleted here.
 *
 * `create` is S-09.9 ("add a custom expense account, so my categories
 * match my business") — deliberately not restricted to `type: "expense"`
 * despite the story's own wording, since a custom income/asset account is
 * exactly as valid a business need and there's no reason to special-case
 * expense here when the same CRUD serves every account type identically.
 */
@Injectable()
export class AccountsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(orgId: string, input: CreateAccountInput) {
    const [existing] = await this.db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, input.code)));
    if (existing) {
      throw new BadRequestException(`An account with code ${input.code} already exists`);
    }
    const [row] = await this.db
      .insert(accounts)
      .values({
        orgId,
        code: input.code,
        name: input.name,
        type: input.type,
        parentId: input.parentId ?? null,
        isSystem: false,
      })
      .returning();
    return row;
  }

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
