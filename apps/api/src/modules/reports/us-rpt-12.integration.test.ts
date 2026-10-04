import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { journalEntries, journalLines, member, notifications, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { LedgerIntegrityService, outOfBalanceMessage } from "./ledger-integrity.service";

/**
 * US-RPT-12 — the daily ledger check. The database trigger refuses an
 * unbalanced entry, so the test makes the kind of "data repair" mistake
 * this guards against by writing a journal line with triggers switched
 * off. Demo-seeded org. Requires local Postgres (as a superuser).
 */
describe("US-RPT-12 · warn me if the books ever stop balancing (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-rpt-12-${randomUUID()}@example.com`;
  let cookie: string;
  let orgId: string;
  let userId: string;

  const status = async () =>
    (await (await fetch(`${testApp.baseUrl}/reports/ledger-integrity`, { headers: { cookie } })).json()) as { balanced: boolean; message: string | null };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Books Owner" });
    cookie = owner.cookie;
    userId = owner.userId;
    const [m] = await db.select().from(member).where(eq(member.userId, owner.userId));
    orgId = m!.organizationId;
    const seeded = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie, "Idempotency-Key": randomUUID() } });
    expect(seeded.status).toBeLessThan(300);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("shows nothing when total debits equal total credits", async () => {
    const service = testApp.app.get(LedgerIntegrityService);
    expect(await service.check(orgId)).toBe(0n);
    expect(await status()).toMatchObject({ balanced: true, message: null });
  });

  it("warns Owners when the books are out, and clears the warning once they balance again", async () => {
    const service = testApp.app.get(LedgerIntegrityService);
    const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.orgId, orgId)).limit(1);
    const [line] = await db.select().from(journalLines).where(eq(journalLines.entryId, entry!.id)).limit(1);

    // A "repair" that leaves 12.34 unbalanced, bypassing the balance trigger.
    const strayId = randomUUID();
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      await tx.insert(journalLines).values({ id: strayId, entryId: entry!.id, accountId: line!.accountId, debit: 1234n, credit: 0n });
    });

    expect(await service.check(orgId)).toBe(1234n);
    const out = await status();
    expect(out.balanced).toBe(false);
    expect(out.message).toBe(outOfBalanceMessage(1234n, "USD"));
    expect(out.message).toMatch(/^Your books are out of balance by 12\.34 [A-Z]{3}\. Contact the person who runs Spine\.$/);

    const [sent] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.orgId, orgId), eq(notifications.recipientUserId, userId), eq(notifications.type, "ledger_out_of_balance")));
    expect(sent?.message).toMatch(/^Your books are out of balance by 12\.34/);

    // The repair is undone: the next check passes and the warning goes.
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      await tx.delete(journalLines).where(eq(journalLines.id, strayId));
    });
    expect(await service.check(orgId)).toBe(0n);
    expect(await status()).toMatchObject({ balanced: true, message: null });
  });
});
