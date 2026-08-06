import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { auth } from "./auth";
import { createDb, type Database } from "../db/client";
import { accounts, member, session as sessionTable, user } from "../db/schema";

/**
 * Regression coverage for two real bugs found while wiring the onboarding
 * wizard's signup path — both would otherwise silently break every fresh
 * signup:
 *
 *  1. Chart-of-accounts seeding was only wired into the standalone seed
 *     script, never the real `databaseHooks.user.create.after` hook a real
 *     signup goes through — a real user got zero accounts.
 *  2. `session.activeOrganizationId` stayed `null` after signup — Better
 *     Auth's organization plugin doesn't set it on org creation, so every
 *     `@OrgRoles()`-guarded endpoint would 403 a brand-new owner.
 *
 * Requires the `db` service from docker-compose.dev.yml running locally.
 */
describe("signup (requires local Postgres)", () => {
  let db: Database;
  const createdEmails: string[] = [];

  afterAll(async () => {
    if (createdEmails.length === 0) return;
    // Deleting the user cascades to member/session/account rows; the
    // organization the hook created is left behind (no FK back from
    // organization to user to cascade through) but is harmless test debris
    // in a throwaway dev DB, same as the ledger-integrity suite's own
    // TRUNCATE-based cleanup leaves other tables alone between files.
    await db.delete(user).where(inArray(user.email, createdEmails));
  });

  it("seeds the chart of accounts and sets an active org on the session for a brand-new signup", async () => {
    const databaseUrl = process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine";
    db = createDb(databaseUrl);

    const email = `signup-test-${Date.now()}@example.com`;
    createdEmails.push(email);

    const signUpResult = await auth.api.signUpEmail({
      body: { email, password: "testpassword123", name: "Signup Test" },
    });
    const userId = signUpResult.user.id;

    const [membership] = await db.select().from(member).where(eq(member.userId, userId));
    expect(membership).toBeDefined();
    const orgId = membership!.organizationId;

    // Bug #1: chart of accounts must exist for this org without a separate
    // seed-script call.
    const orgAccounts = await db.select().from(accounts).where(eq(accounts.orgId, orgId));
    expect(orgAccounts.length).toBeGreaterThan(0);
    expect(orgAccounts.some((a) => a.code === "1100" && a.isSystem)).toBe(true);

    // Bug #2: the session created during signup must have activeOrganizationId
    // pointed at the org the hook created, not null.
    const [signupSession] = await db.select().from(sessionTable).where(eq(sessionTable.userId, userId));
    expect(signupSession).toBeDefined();
    expect(signupSession!.activeOrganizationId).toBe(orgId);
  });
});
