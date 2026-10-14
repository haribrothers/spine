import { APIError } from "better-auth/api";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { invitation, member, settings, user } from "../db/schema";

export const INVITE_ONLY_MESSAGE = "This Spine is invite-only. Ask an owner to invite you — you'll get an email with a link to join.";

/**
 * Tests (and only tests) create a fresh organisation per case, so they can
 * keep sign-up open. Never honoured in production.
 */
export function openSignupForced(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SPINE_ALLOW_OPEN_SIGNUP === "true" && env.NODE_ENV !== "production";
}

/**
 * US-AUTH-08 (D-084) — sign-up is open only while the instance has no
 * users: the first account becomes the Primary Owner, and everyone after
 * joins by invitation. The business name is the only instance detail
 * shown to anonymous visitors.
 */
export async function signupStatus(db: Database): Promise<{ open: boolean; businessName: string | null; newInstall: boolean }> {
  const [{ count } = { count: 0 }] = await db.select({ count: sql<number>`count(*)::int` }).from(user);
  // US-AUTH-13: no account at all yet, so `/` and `/login` open the welcome page (tests may force `open`, never this).
  const newInstall = count === 0;
  if (newInstall || openSignupForced()) return { open: true, businessName: null, newInstall };

  const [primary] = await db
    .select({ orgId: member.organizationId })
    .from(member)
    .where(eq(member.isPrimaryOwner, true))
    .orderBy(asc(member.createdAt))
    .limit(1);
  if (!primary) return { open: false, businessName: null, newInstall };
  const [profile] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.orgId, primary.orgId), eq(settings.key, "business_profile")));
  const name = (profile?.value as { name?: string } | undefined)?.name?.trim();
  return { open: false, businessName: name || null, newInstall };
}

/**
 * Refuses a new account on an instance that already has users, unless it
 * completes a pending invitation for that email. The server-side half of
 * US-AUTH-08: the sign-up page hides its form, and this stops a direct API
 * call from creating a second organisation.
 */
export async function assertSignupAllowed(db: Database, email: string): Promise<void> {
  if (openSignupForced()) return;
  const [anyUser] = await db.select({ id: user.id }).from(user).limit(1);
  if (!anyUser) return;
  const [pending] = await db
    .select({ id: invitation.id })
    .from(invitation)
    // US-ONB-35: the demo's invites are for show — they never open sign-up.
    .where(and(eq(invitation.email, email.toLowerCase()), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date()), eq(invitation.isDemo, false)))
    .limit(1);
  if (!pending) throw new APIError("FORBIDDEN", { message: INVITE_ONLY_MESSAGE });
}
