import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { member, organization } from "../../db/schema";
import { signUp } from "../../test-utils/test-app";

/** An owner's organisation plus a Field member in it — the field app's usual caller. */
export async function ownerWithFieldUser(baseUrl: string, db: Database, emails: string[]) {
  const ownerEmail = `mob-owner-${randomUUID()}@example.com`;
  const fieldEmail = `mob-field-${randomUUID()}@example.com`;
  emails.push(ownerEmail, fieldEmail);
  const owner = await signUp(baseUrl, { email: ownerEmail, password: "testpassword123", name: "Mob Owner" });
  const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.userId));
  const orgId = ownerMembership!.organizationId;
  const [org] = await db.select().from(organization).where(eq(organization.id, orgId));
  const field = await signUp(baseUrl, { email: fieldEmail, password: "testpassword123", name: "Marcus Webb" });
  await db.delete(member).where(eq(member.userId, field.userId));
  const [fieldMember] = await db
    .insert(member)
    .values({ id: randomUUID(), organizationId: orgId, userId: field.userId, role: "field", createdAt: new Date() })
    .returning();
  return { orgId, businessName: org!.name, ownerCookie: owner.cookie, fieldEmail, fieldMemberId: fieldMember!.id, fieldUserId: field.userId };
}

/** Signs in the way the phone does: email and password, keeping the bearer token from `set-auth-token`. */
export async function bearerSignIn(baseUrl: string, email: string, password: string) {
  const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { res, token: res.headers.get("set-auth-token") };
}
