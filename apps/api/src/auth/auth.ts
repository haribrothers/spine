import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getIp } from "better-auth/api";
import { isCommonPassword, PASSWORD_TOO_COMMON_MESSAGE } from "@spine/shared";
import { assertSignupAllowed } from "./signup-policy";
import { RESET_TOKEN_TTL_SECONDS, RESET_TOO_MANY_MESSAGE, resetIpLimiter, sendResetPasswordEmail } from "./password-reset";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";
import { jwt } from "better-auth/plugins/jwt";
import { organization } from "better-auth/plugins/organization";
import { and, desc, eq, gt } from "drizzle-orm";
import { createDb } from "../db/client";
import {
  invitation as invitationTable,
  member,
  organization as organizationTable,
  session as sessionTable,
  user as userTable,
} from "../db/schema";
import { EmailService } from "../modules/email/email.service";
import { loadEmailBrand } from "../modules/email/email-brand";
import { appUrl, renderEmail } from "../modules/email/email-layout";
import { invitationEmail } from "../modules/email/email-templates";
import { seedChartOfAccounts } from "../db/seed/chart-of-accounts";
import { seedDefaultTeam } from "../db/seed/default-team";
import { seedLeadStages } from "../db/seed/lead-stages";
import { accessControl, fieldRole, ownerRole, staffRole } from "./access-control";
import { hashPassword, verifyPassword } from "./password";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const db = createDb(databaseUrl);
const authLogger = new Logger("Auth");

/**
 * Cookie sessions for web, a Bearer-sent session token for mobile — see
 * the `bearer()` plugin's own doc comment below for why this is the
 * `bearer` plugin, not the `jwt` plugin, despite docs/archive/spine-prd.md §5's
 * original "JWT for mobile" phrasing (a real design correction made
 * during Phase 5's mobile-auth build, not the original plan). The
 * organization plugin is what makes membership/role per-org (§2.1); `jwt()`
 * stays configured for future third-party/external JWKS-verification needs,
 * unrelated to how this API's own AuthGuard authenticates mobile's requests.
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
    // US-AUTH-09/10 — reset by emailed link. One use, one hour, and a
    // successful reset signs the account out everywhere else.
    sendResetPassword: async ({ user, token }) => {
      const [membership] = await db
        .select({ orgId: member.organizationId })
        .from(member)
        .where(eq(member.userId, user.id))
        .orderBy(desc(member.createdAt))
        .limit(1);
      await sendResetPasswordEmail({ user, token }, membership ? await loadEmailBrand(db, membership.orgId) : undefined, { db, orgId: membership?.orgId ?? null });
    },
    resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
    revokeSessionsOnPasswordReset: true,
  },
  hooks: {
    /**
     * US-AUTH-09 — reset requests are limited per IP here (Better Auth's own
     * rate limiter is off outside production and would also throttle
     * sign-in); the per-email limit lives in `sendResetPasswordEmail`.
     */
    before: createAuthMiddleware(async (ctx) => {
      // US-AUTH-15 (D-207): the most common passwords are refused wherever one is chosen.
      const chosen = ctx.path === "/sign-up/email" ? ctx.body?.password : ctx.path === "/reset-password" || ctx.path === "/change-password" ? ctx.body?.newPassword : undefined;
      if (typeof chosen === "string" && isCommonPassword(chosen)) {
        throw new APIError("BAD_REQUEST", { message: PASSWORD_TOO_COMMON_MESSAGE, code: "PASSWORD_TOO_COMMON" });
      }
      if (ctx.path !== "/request-password-reset") return;
      const ip = (ctx.request && getIp(ctx.request, ctx.context.options)) || "unknown";
      if (!resetIpLimiter.hit(ip)) throw new APIError("TOO_MANY_REQUESTS", { message: RESET_TOO_MANY_MESSAGE });
    }),
  },
  /**
   * Explicit, not Better Auth's undocumented defaults (7-day expiresIn /
   * 1-day updateAge) — Phase 5 (Mobile) needs "log in once, stay logged
   * in" (S-11.1) to be a real, intentional value rather than an implicit
   * one nobody chose. There is no per-client-type session config in Better
   * Auth (confirmed against @better-auth/core's init-options.d.mts before
   * assuming otherwise) — web and the Expo app share this one setting.
   * 30 days with a 7-day rolling refresh means any session used at least
   * once a week never actually expires (each use resets the clock), which
   * covers a field crew's realistic weekly-or-more usage pattern without
   * an unboundedly long session on a device that's lost or reassigned.
   * Mobile sends this session's own token directly as a Bearer header on
   * every request (via the `bearer()` plugin below, persisted through
   * `expo-secure-store` by `expoClient`) rather than minting a separate
   * short-lived token per request — only a session that's actually
   * expired or revoked forces mobile back to a real login screen. See
   * CHANGELOG's Phase 5 Stage 4 entry for the full auth-flow design.
   */
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24 * 7,
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
      /**
       * Without this, POST /org/invitations (InvitationsController, wrapping
       * auth.api.createInvitation) still creates the `invitation` row but
       * the plugin silently skips sending anything — no error, no log, just
       * a real invite an invitee never learns about. `EmailService` is a
       * plain class with no DI dependencies (only reads process.env
       * internally, same as this file's own `createDb` usage), so it's
       * constructed directly here rather than injected — this module lives
       * outside Nest's DI graph entirely.
       *
       * Better Auth does not generate the accept-invitation URL itself (see
       * this option's own doc comment in node_modules) — id is the
       * invitation's own id, used to build the link to the web app's
       * accept-invite page, which calls auth.api.acceptInvitation with it.
       */
      sendInvitationEmail: async (data) => {
        const emailService = new EmailService(db);
        const acceptUrl = appUrl(`/accept-invite/${data.id}`);
        // US-NTF-11: the business name from the business profile, not the
        // organisation row ("<Owner>'s Organisation" until US-TEAM-15).
        const brand = await loadEmailBrand(db, data.organization.id);
        const template = invitationEmail({ businessName: brand.name, inviterName: data.inviter.user.name, role: data.role, acceptUrl });
        // US-SET-27 (D-220): recorded in the email log, sent or not.
        const log = { orgId: data.organization.id, kind: "invitation" as const, userId: data.inviter.user.id };
        if (!emailService.isConfigured()) {
          await emailService.recordNotSent(log, data.email, template.subject);
          return;
        }
        const email = renderEmail(brand, template.content);
        await emailService.send({
          to: data.email,
          fromName: brand.name,
          subject: template.subject,
          text: email.text,
          html: email.html,
          attachments: email.attachments,
          log,
        });
      },
    }),
    jwt({
      jwt: {
        expirationTime: "15m",
      },
    }),
    /**
     * Phase 5 (Mobile) — corrects a real design gap found while building
     * mobile's auth flow: `@thallesp/nestjs-better-auth`'s `AuthGuard`
     * forwards every request header (including `Authorization`) into
     * `auth.api.getSession(...)`, but that only ever resolves a COOKIE or
     * (with this plugin) a raw session token sent as `Authorization:
     * Bearer <session token>` — it never verifies a `jwt()`-minted JWT.
     * The two plugins solve different problems: `jwt()` above issues
     * short-lived, JWKS-verifiable tokens for a THIRD PARTY to verify
     * independently (no round-trip to this API); `bearer()` here is the
     * standard "send the session over a header instead of a cookie"
     * mechanism RN needs since it has no cookie jar. Mobile's own auth
     * client (`apps/mobile/src/lib/auth/auth-client.ts`) sends the
     * session token `expoClient` already persists via `expo-secure-store`
     * as this Bearer value — no separate JWT-minting round trip per
     * request. See CHANGELOG's Phase 5 Stage 4 entry for the full
     * corrected auth-flow design and how this was discovered (a live
     * 401 against a real endpoint, not a typecheck).
     */
    bearer(),
  ],
  databaseHooks: {
    user: {
      create: {
        /**
         * Every sign-up is a brand-new organisation's owner — there is no
         * "join an existing org" self-serve path in v1 (§12 Phase 0 exit:
         * "sign up ... complete the onboarding wizard") — EXCEPT when this
         * signup is completing a pending invitation (the `/signup?inviteId=`
         * flow from `NeedsAccountPrompt` in accept-invite-view.tsx). That
         * user is about to call `acceptInvitation` and get a real org
         * membership within seconds; giving them a second, throwaway solo
         * org first was a real, live-reported bug — not just clutter in the
         * DB, but a source of a second membership row that a later
         * re-login's `session.create.after` hook (below) could pick over
         * the real invited org, since ordering by recency alone can't
         * distinguish "a solo org nobody asked for" from "a real org the
         * user works in" when both are real membership rows. The only
         * robust fix is to never create the throwaway org in the first
         * place. Checked server-side (a pending, unexpired `invitation` row
         * matching this email) rather than trusting a client-supplied flag,
         * so it can't be bypassed or missed if the client forgets to signal
         * it — same trust model as `acceptInvitation` itself, which also
         * re-validates the invitation server-side rather than trusting the
         * caller. Matched case-insensitively, same as `acceptInvitation`'s
         * own `invitation.email.toLowerCase() !== session.user.email.toLowerCase()`
         * check.
         *
         * MUST NOT let org creation fail silently when it DOES run.
         * `databaseHooks.user.create.after` runs after the `user` row is
         * already committed — if `createOrganization`/`seedChartOfAccounts`
         * throws and this hook lets that propagate uncaught, Better Auth's
         * own hook runner may swallow it (observed live: a real account
         * ended up with a `user` row, zero `organization`/`member` rows,
         * and a session whose `activeOrganizationId` pointed at nothing —
         * every `@OrgRoles()`-guarded request then 403'd with "You are not
         * a member of this organization" forever, with no way to recover
         * short of manual DB surgery). Since a user with no org and no
         * pending invite is completely unusable regardless (S-01.1 onward
         * assumes one), the only sound recovery in that case is to delete
         * the just-created user on failure, so the whole signup genuinely
         * fails end-to-end and the client sees a real error — leaving them
         * free to retry with the same email — rather than a phantom
         * "successful" signup that's broken forever.
         */
        /** US-AUTH-08 — closed sign-up: only the first account, or an invited email, may be created. */
        before: async (user) => {
          await assertSignupAllowed(db, user.email);
          return { data: user };
        },
        after: async (user) => {
          const [pendingInvitation] = await db
            .select({ id: invitationTable.id })
            .from(invitationTable)
            .where(
              and(
                eq(invitationTable.email, user.email.toLowerCase()),
                eq(invitationTable.status, "pending"),
                gt(invitationTable.expiresAt, new Date()),
              ),
            )
            .limit(1);
          if (pendingInvitation) {
            return;
          }

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

            // PRD §2.1/§7 — the first signup on a fresh instance is always
            // this org's Primary Owner (super-admin). auth.api.createOrganization
            // creates the member row (role: "owner", per creatorRole above)
            // but Better Auth's organization plugin has no concept of
            // "primary owner" — set directly via Drizzle, same pattern as
            // the session hook below backfilling activeOrganizationId.
            // allowUserToCreateOrganization: false guarantees this call is
            // always exactly one brand-new org's first (and only) member,
            // so there is no ambiguity about who the Primary Owner is.
            await db
              .update(member)
              .set({ isPrimaryOwner: true })
              .where(and(eq(member.organizationId, org.id), eq(member.userId, user.id)));

            // Seed the "General Staff" team so a newly invited Staff user
            // has sensible default access with zero extra owner setup.
            await seedDefaultTeam(db, org.id);

            // US-CRM-19 — the default pipeline stages.
            await seedLeadStages(db, org.id);
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
         *
         * Ordered by `member.createdAt` DESC (most-recently-joined org
         * wins), not an arbitrary row. Belt-and-suspenders alongside
         * `user.create.after`'s pending-invitation check above (which stops
         * an invited user from ever getting a throwaway solo org in the
         * first place, so a normal invited user has exactly one membership
         * here, not two) — this ordering is what makes the fallback correct
         * on its own terms for any user who does legitimately end up with
         * multiple memberships, rather than silently picking whatever
         * unordered row Postgres happens to return first. An earlier,
         * unordered `.limit(1)` here was a real, live-reproduced bug (found
         * before the `user.create.after` fix above existed): it could
         * non-deterministically pick a solo org over the org the user
         * actually works in, silently scoping every list/read endpoint
         * (`requireOrgId(session)`) to the wrong, empty organisation with no
         * error — contacts/catalogue/etc. all appeared empty.
         */
        after: async (createdSession) => {
          if (createdSession.activeOrganizationId) {
            return;
          }
          const [membership] = await db
            .select({ organizationId: member.organizationId })
            .from(member)
            .where(eq(member.userId, createdSession.userId))
            .orderBy(desc(member.createdAt))
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
