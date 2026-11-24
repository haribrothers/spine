import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../db/client";
import { accounts, moneyAccounts } from "../../db/schema";

/**
 * The ledger codes of every bank and cash money account (D-140), archived
 * ones included so history still adds up. Cards are a liability, not cash.
 * Replaces the fixed 1000/1010 pair that cash figures used before Phase 8.
 */
export async function cashAccountCodes(db: Database, orgId: string): Promise<string[]> {
  const rows = await db
    .select({ code: accounts.code })
    .from(moneyAccounts)
    .innerJoin(accounts, eq(accounts.id, moneyAccounts.accountId))
    .where(and(eq(moneyAccounts.orgId, orgId), inArray(moneyAccounts.kind, ["bank", "cash"])));
  return rows.map((r) => r.code);
}
