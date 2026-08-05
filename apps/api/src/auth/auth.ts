import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins/jwt";
import { organization } from "better-auth/plugins/organization";
import { createDb } from "../db/client";
import { accessControl, fieldRole, ownerRole, staffRole } from "./access-control";
import { hashPassword, verifyPassword } from "./password";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const db = createDb(databaseUrl);

/**
 * Cookie sessions for web, JWT for mobile — per docs/spine-prd.md §5. The
 * organization plugin is what makes membership/role per-org (§2.1); the JWT
 * plugin issues short-lived, JWKS-verifiable tokens for the Expo app without
 * a second auth system.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  baseURL: process.env.APP_URL,
  secret: process.env.AUTH_SECRET,
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
         */
        after: async (user) => {
          await auth.api.createOrganization({
            body: {
              name: `${user.name}'s Organisation`,
              slug: `org-${randomUUID()}`,
              userId: user.id,
            },
          });
        },
      },
    },
  },
});

export type Auth = typeof auth;
