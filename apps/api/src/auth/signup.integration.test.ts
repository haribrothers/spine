import { CAPABILITIES, DEFAULT_TEAM_GRANTS, DEFAULT_TEAM_NAME } from "@spine/shared";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { auth } from "./auth";
import { createDb, type Database } from "../db/client";
import {
  accounts,
  member,
  organization,
  session as sessionTable,
  teamPrivileges,
  teams,
  user,
} from "../db/schema";
import * as chartOfAccountsModule from "../db/seed/chart-of-accounts";

/**
 * Regression coverage for three real bugs found in the signup path — all
 * would otherwise silently break either every fresh signup, or one
 * specific unlucky one, with no way for the affected user to recover
 * short of manual DB surgery:
 *
 *  1. Chart-of-accounts seeding was only wired into the standalone seed
 *     script, never the real `databaseHooks.user.create.after` hook a real
 *     signup goes through — a real user got zero accounts.
 *  2. `session.activeOrganizationId` stayed `null` after signup — Better
 *     Auth's organization plugin doesn't set it on org creation, so every
 *     `@OrgRoles()`-guarded endpoint would 403 a brand-new owner.
 *  3. If org creation (or chart-of-accounts seeding) throws inside that
 *     same hook, the `user` row it runs after was already committed —
 *     found live in the dev DB: a real account had a `user` row, zero
 *     `organization`/`member` rows, and a session pointing at a
 *     nonexistent org, 403ing "You are not a member of this organization"
 *     on every guarded request, forever. The hook now deletes the
 *     orphaned user on failure so the whole signup fails loudly instead —
 *     see auth.ts's own doc comment on this exact incident.
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

    // PRD §2.1/§7: the first signup on a fresh instance is always its
    // Primary Owner.
    expect(membership!.isPrimaryOwner).toBe(true);

    // PRD §2.1/S-10.13-14: every fresh org seeds a default "General Staff"
    // team with the documented default grants, so a newly invited Staff
    // user has sensible access with zero extra owner setup.
    const [defaultTeam] = await db.select().from(teams).where(eq(teams.orgId, orgId));
    expect(defaultTeam).toBeDefined();
    expect(defaultTeam!.name).toBe(DEFAULT_TEAM_NAME);
    expect(defaultTeam!.isDefault).toBe(true);

    const privileges = await db.select().from(teamPrivileges).where(eq(teamPrivileges.teamId, defaultTeam!.id));
    expect(privileges).toHaveLength(CAPABILITIES.length);
    const grantsByCapability = Object.fromEntries(privileges.map((p) => [p.capability, p.granted]));
    expect(grantsByCapability).toEqual(DEFAULT_TEAM_GRANTS);
  });

  it("rejects a second Primary Owner in the same org at the database level", async () => {
    const databaseUrl = process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine";
    db = createDb(databaseUrl);

    const primaryEmail = `signup-primary-${Date.now()}@example.com`;
    createdEmails.push(primaryEmail);

    const primary = await auth.api.signUpEmail({
      body: { email: primaryEmail, password: "testpassword123", name: "Primary Owner" },
    });
    const [primaryMembership] = await db.select().from(member).where(eq(member.userId, primary.user.id));
    const orgId = primaryMembership!.organizationId;

    // Simulate promoting a second member to Owner and attempting to also
    // mark them Primary Owner (an application bug this partial unique
    // index exists specifically to prevent) by inserting a second member
    // row for the same org with isPrimaryOwner already true. postgres-js
    // wraps the real Postgres error as `.cause` behind a generic "Failed
    // query" top-level message, so assert on the cause, not `.message`.
    let caught: unknown;
    try {
      await db.insert(member).values({
        id: `test-second-owner-${Date.now()}`,
        organizationId: orgId,
        userId: primary.user.id, // reusing the same user is irrelevant to this check — the index is keyed on organizationId alone
        role: "owner",
        createdAt: new Date(),
        isPrimaryOwner: true,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    const cause = caught instanceof Error ? (caught.cause ?? caught) : caught;
    expect(String(cause)).toMatch(/duplicate key|unique constraint|member_org_primary_owner_uidx/i);
  });

  it("deletes the orphaned user instead of leaving a broken account when org setup fails mid-signup", async () => {
    const databaseUrl = process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine";
    db = createDb(databaseUrl);

    const email = `signup-fail-test-${Date.now()}@example.com`;

    // Force exactly the failure mode found live: createOrganization
    // succeeds, but the hook's own follow-up work throws.
    const seedSpy = vi.spyOn(chartOfAccountsModule, "seedChartOfAccounts").mockRejectedValueOnce(new Error("simulated seed failure"));

    await expect(
      auth.api.signUpEmail({
        body: { email, password: "testpassword123", name: "Signup Fail Test" },
      }),
    ).rejects.toThrow();

    seedSpy.mockRestore();

    // The whole point: no orphaned user, no dangling org/member/session —
    // the failed signup must leave NO trace, not a half-created account.
    const [orphanedUser] = await db.select().from(user).where(eq(user.email, email));
    expect(orphanedUser).toBeUndefined();

    const danglingOrgs = await db.select().from(organization).where(eq(organization.name, "Signup Fail Test's Organisation"));
    expect(danglingOrgs).toHaveLength(0);
  });
});
