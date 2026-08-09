import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins/jwt";
import { organization } from "better-auth/plugins/organization";
import { eq } from "drizzle-orm";
import { createDb } from "../db/client";
import { member, organization as organizationTable, session as sessionTable, user as userTable } from "../db/schema";
import { seedChartOfAccounts } from "../db/seed/chart-of-accounts";
import { accessControl, fieldRole, ownerRole, staffRole } from "./access-control";
import { hashPassword, verifyPassword } from "./password";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const db = createDb(databaseUrl);
const authLogger = new Logger("Auth");

/**
 * Cookie sessions for web, JWT for mobile — per docs/spine-prd.md §5. The
 * organization plugin is what makes membership/role per-org (§2.1); the JWT
 * plugin issues short-lived, JWKS-verifiable tokens for the Expo app without
 * a second auth system.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  // `baseURL` is where Better Auth's own handler is reachable (this API
  // process, mounted at basePath "/api/auth" by @thallesp/nestjs-better-auth
  // — see main.ts for the port). It is NOT the web app's origin — APP_URL is
  // used below only as the CORS-allowed origin, i.e. where browser requests
  // originate from, which is a different concern.
  baseURL: process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,
  secret: process.env.AUTH_SECRET,
  trustedOrigins: process.env.APP_URL ? [process.env.APP_URL] : undefined,
  emailAndPassword: {
    enabled: true,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
  },
  plugins: [
    organization({
      ac: accessControl,
      roles: {
        owner: ownerRole,
        staff: staffRole,
        field: fieldRole,
      },
      creatorRole: "owner",
      // The only path to a new org is signup (via the hook below), which
      // calls auth.api.createOrganization server-side — that bypasses this
      // flag, which only gates the public /organization/create endpoint.
      // Invited members join an existing org; nobody self-serves a second
      // one in v1.
      allowUserToCreateOrganization: false,
    }),
    jwt({
      jwt: {
        expirationTime: "15m",
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        /**
         * Every sign-up is a brand-new organisation's owner — there is no
         * "join an existing org" self-serve path in v1 (§12 Phase 0 exit:
         * "sign up ... complete the onboarding wizard"). Invited members are
         * added to an existing org separately, never through this hook.
         *
         * MUST NOT let this fail silently. `databaseHooks.user.create.after`
         * runs after the `user` row is already committed — if
         * `createOrganization`/`seedChartOfAccounts` throws and this hook
         * lets that propagate uncaught, Better Auth's own hook runner may
         * swallow it (observed live: a real account ended up with a `user`
         * row, zero `organization`/`member` rows, and a session whose
         * `activeOrganizationId` pointed at nothing — every
         * `@OrgRoles()`-guarded request then 403'd with "You are not a
         * member of this organization" forever, with no way to recover
         * short of manual DB surgery). Since a user with no org is
         * completely unusable regardless (S-01.1 onward assumes one), the
         * only sound recovery is to delete the just-created user on
         * failure, so the whole signup genuinely fails end-to-end and the
         * client sees a real error — leaving them free to retry with the
         * same email — rather than a phantom "successful" signup that's
         * broken forever.
         */
        after: async (user) => {
          let createdOrgId: string | undefined;
          try {
            const org = await auth.api.createOrganization({
              body: {
                name: `${user.name}'s Organisation`,
                slug: `org-${randomUUID()}`,
                userId: user.id,
              },
            });
            if (!org?.id) {
              throw new Error("auth.api.createOrganization returned no organisation id");
            }
            createdOrgId = org.id;

            // Every org needs a chart of accounts to post anything to the
            // ledger — without this, a real signup produced a functionally
            // broken org (no accounts to post to, nothing for the onboarding
            // wizard's CoA-review step to show). Previously this only ran
            // from the standalone seed script, never from real signup.
            await seedChartOfAccounts(db, org.id);
          } catch (err) {
            authLogger.error(
              `Signup for ${user.email} (user ${user.id}) failed to create its organisation — deleting the orphaned user${createdOrgId ? " and organisation" : ""} row(s) so signup fails cleanly instead of leaving a permanently broken account`,
              err instanceof Error ? err.stack : String(err),
            );
            // member cascades on user delete (onDelete: "cascade"), but
            // `organization` has no FK back to the user/member that created
            // it, so it would otherwise leak as a permanent, empty,
            // unowned org — deleted explicitly here when we got far enough
            // to have created one.
            if (createdOrgId) {
              await db.delete(organizationTable).where(eq(organizationTable.id, createdOrgId));
            }
            await db.delete(userTable).where(eq(userTable.id, user.id));
            throw err;
          }
        },
      },
    },
    session: {
      create: {
        /**
         * `auth.api.createOrganization` (above) does not set the *session's*
         * `activeOrganizationId` — it only creates the org/membership rows.
         * Left unset, `session.activeOrganizationId` stays `null` forever
         * for a user who only ever has one org, which silently breaks every
         * `@OrgRoles()`-guarded endpoint (`checkOrgRole` in
         * @thallesp/nestjs-better-auth requires an active org on the
         * session and returns false without one) — a real bug that would
         * otherwise 403 every onboarding-wizard call for a brand-new user.
         * Since v1 has no multi-org self-serve path (§12), defaulting a
         * fresh session to the user's first (and normally only) org
         * membership is safe and correct for both signup and later logins.
         *
         * The organization plugin marks `session.activeOrganizationId` as
         * `input: false` (see its schema config) — a client/hook-supplied
         * value on session *create* is silently dropped by Better Auth's
         * own field filtering, so mutating the `before` payload has no
         * effect. Setting it via a direct `after`-hook UPDATE instead,
         * which goes through Drizzle directly and bypasses that filter,
         * reliably lands the value.
         */
        after: async (createdSession) => {
          if (createdSession.activeOrganizationId) {
            return;
          }
          const [membership] = await db
            .select({ organizationId: member.organizationId })
            .from(member)
            .where(eq(member.userId, createdSession.userId))
            .limit(1);
          if (!membership) {
            return;
          }
          await db
            .update(sessionTable)
            .set({ activeOrganizationId: membership.organizationId })
            .where(eq(sessionTable.id, createdSession.id));
        },
      },
    },
  },
});

export type Auth = typeof auth;
