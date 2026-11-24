import { randomUUID } from "node:crypto";
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
 * US-OPS-02 (D-086) — the setting `SEED_DEMO` leaves on the demo business it
 * loads at first start, until the first sign-up claims it. Its value names
 * the placeholder Owner the demo was loaded as, who has no password.
 */
export const DEMO_AWAITING_OWNER_KEY = "demo_awaiting_owner";

export interface DemoAwaitingOwner {
  placeholderUserId: string;
}

/** Whether a demo business from `SEED_DEMO` is still waiting for its owner. */
export async function demoAwaitingOwner(db: Database): Promise<boolean> {
  const [row] = await db.select({ id: settings.id }).from(settings).where(eq(settings.key, DEMO_AWAITING_OWNER_KEY)).limit(1);
  return Boolean(row);
}

/**
 * US-OPS-02 (D-086) — the first sign-up on a `SEED_DEMO` instance becomes
 * the demo business's Primary Owner, in place of its placeholder Owner.
 * Taking the marker row under a lock makes this once only: a second sign-up
 * at the same moment finds no marker (and sign-up closed). Returns the
 * business's id, or null when there's no demo waiting.
 */
export async function claimDemoBusiness(db: Database, userId: string): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [marker] = await tx.select().from(settings).where(eq(settings.key, DEMO_AWAITING_OWNER_KEY)).limit(1).for("update", { skipLocked: true });
    if (!marker) return null;
    await tx.delete(settings).where(eq(settings.id, marker.id));
    const { placeholderUserId } = marker.value as DemoAwaitingOwner;
    await tx.delete(member).where(and(eq(member.organizationId, marker.orgId), eq(member.userId, placeholderUserId)));
    await tx.insert(member).values({ id: randomUUID(), organizationId: marker.orgId, userId, role: "owner", isPrimaryOwner: true, createdAt: new Date() });
    return marker.orgId;
  });
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
  // US-OPS-02: a demo business loaded by SEED_DEMO waits for its first sign-up the same way.
  const newInstall = count === 0 || (await demoAwaitingOwner(db));
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
  if (!anyUser || (await demoAwaitingOwner(db))) return;
  const [pending] = await db
    .select({ id: invitation.id })
    .from(invitation)
    // US-ONB-35: the demo's invites are for show — they never open sign-up.
    .where(and(eq(invitation.email, email.toLowerCase()), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date()), eq(invitation.isDemo, false)))
    .limit(1);
  if (!pending) throw new APIError("FORBIDDEN", { message: INVITE_ONLY_MESSAGE });
}
