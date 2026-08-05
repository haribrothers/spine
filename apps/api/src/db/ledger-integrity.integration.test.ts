import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "./client";
import { accounts, journalEntries, journalLines, organisations } from "./schema";

/**
 * Exercises the DB-level invariants from docs/spine-prd.md §6.3 directly —
 * these are enforced by triggers/constraints in drizzle/0001_ledger_integrity_triggers.sql,
 * not application code, so the only way to trust them is to hit real Postgres.
 * Requires the `db` service from docker-compose.yml running locally.
 */
describe("ledger integrity (requires local Postgres)", () => {
  let db: Database;
  let orgId: string;
  let bankAccountId: string;
  let salesAccountId: string;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine";
    db = createDb(databaseUrl);

    const [org] = await db.insert(organisations).values({ name: "Integrity Test Org" }).returning();
    orgId = org!.id;

    const [bank, sales] = await db
      .insert(accounts)
      .values([
        { orgId, code: "1010", name: "Bank Account", type: "asset" },
        { orgId, code: "4000", name: "Sales", type: "income" },
      ])
      .returning();
    bankAccountId = bank!.id;
    salesAccountId = sales!.id;
  });

  afterAll(async () => {
    // TRUNCATE bypasses the per-row immutability triggers (they only guard
    // UPDATE/DELETE), which is what test cleanup needs but a real org's data
    // never should get.
    await db.execute(
      sql`TRUNCATE journal_lines, journal_entries, accounts, organisations RESTART IDENTITY CASCADE`,
    );
  });

  it("accepts a balanced journal entry", async () => {
    const entryId = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(journalEntries).values({
        id: entryId,
        orgId,
        date: "2026-08-05",
        sourceType: "test",
        sourceId: randomUUID(),
      });
      await tx.insert(journalLines).values([
        { entryId, accountId: bankAccountId, debit: 10000n, credit: 0n },
        { entryId, accountId: salesAccountId, debit: 0n, credit: 10000n },
      ]);
    });

    const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.id, entryId));
    expect(entry?.totalDebits).toBe(10000n);
    expect(entry?.totalCredits).toBe(10000n);
  });

  it("rejects an unbalanced journal entry at commit", async () => {
    const entryId = randomUUID();

    await expect(
      db.transaction(async (tx) => {
        await tx.insert(journalEntries).values({
          id: entryId,
          orgId,
          date: "2026-08-05",
          sourceType: "test",
          sourceId: randomUUID(),
        });
        await tx.insert(journalLines).values([
          { entryId, accountId: bankAccountId, debit: 10000n, credit: 0n },
          { entryId, accountId: salesAccountId, debit: 0n, credit: 5000n },
        ]);
      }),
    ).rejects.toThrow(/unbalanced/);
  });

  it("rejects editing a committed journal line", async () => {
    const entryId = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(journalEntries).values({
        id: entryId,
        orgId,
        date: "2026-08-05",
        sourceType: "test",
        sourceId: randomUUID(),
      });
      await tx.insert(journalLines).values([
        { entryId, accountId: bankAccountId, debit: 10000n, credit: 0n },
        { entryId, accountId: salesAccountId, debit: 0n, credit: 10000n },
      ]);
    });

    await expect(
      db.update(journalLines).set({ debit: 99999n }).where(eq(journalLines.entryId, entryId)),
    ).rejects.toThrow(/immutable/);
  });

  it("rejects deleting a committed journal entry", async () => {
    const entryId = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(journalEntries).values({
        id: entryId,
        orgId,
        date: "2026-08-05",
        sourceType: "test",
        sourceId: randomUUID(),
      });
      await tx.insert(journalLines).values([
        { entryId, accountId: bankAccountId, debit: 10000n, credit: 0n },
        { entryId, accountId: salesAccountId, debit: 0n, credit: 10000n },
      ]);
    });

    await expect(db.delete(journalEntries).where(eq(journalEntries.id, entryId))).rejects.toThrow(
      /cannot be deleted/,
    );
  });
});
