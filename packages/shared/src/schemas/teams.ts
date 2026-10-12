import { z } from "zod";
import { capabilitySchema } from "./permissions.ts";

// Better Auth's `member.id` is its own generated text id, not a UUID we
// control — validate as a non-empty string, not uuidSchema.
const memberIdSchema = z.string().min(1);

export const createTeamSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const updateTeamSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
});

export const setTeamPrivilegesSchema = z.object({
  privileges: z.array(z.object({ capability: capabilitySchema, granted: z.boolean() })).min(1),
});

/** Full-replace semantics — an empty array removes every member from the team. */
export const assignTeamMembersSchema = z.object({
  memberIds: z.array(memberIdSchema),
});

export const transferPrimaryOwnerSchema = z.object({
  newPrimaryOwnerMemberId: memberIdSchema,
});

const teamIdsSchema = z.array(z.string().uuid()).max(50);

/** US-TEAM-20 (D-232) — the Teams a Staff member is on, replaced as a whole. */
export const setMemberTeamsSchema = z.object({
  teamIds: teamIdsSchema,
});

/** US-TEAM-22 — Staff ↔ Field only; to Staff, the Teams they join (the default Team when left out). */
export const changeMemberRoleSchema = z.object({
  role: z.enum(["staff", "field"]),
  teamIds: teamIdsSchema.optional(),
});

export const MAX_INVITES_AT_ONCE = 20;

/**
 * US-TEAM-21 — several people at once, onto their Teams. The emails are
 * checked one by one on the server, so one that isn't an address is
 * skipped with its reason rather than refusing the rest.
 */
export const inviteMembersSchema = z.union([
  z.object({
    emails: z.array(z.string().trim().min(1).max(320)).min(1).max(MAX_INVITES_AT_ONCE),
    role: z.enum(["staff", "field"]),
    teamIds: teamIdsSchema.optional(),
  }),
  // The single invite the onboarding wizard sends.
  z.object({ email: z.string().trim().min(1).max(320), role: z.enum(["staff", "field"]) }),
]);

export type InviteSkipReason = "already a member" | "already invited — resend it instead" | "not an email address" | "couldn't be invited";

export interface InviteMembersResult {
  invited: { id: string; email: string }[];
  skipped: { email: string; reason: InviteSkipReason }[];
}

const emailAddress = z.string().email();

/** Whether this reads as an email address (the same check the server makes). */
export function isEmailAddress(value: string): boolean {
  return emailAddress.safeParse(value.trim()).success;
}

/** "a@x.com, b@x.com\nc@x.com" → each address once, lower-cased, in the order typed. */
export function parseEmailList(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase();
    if (email) seen.add(email);
  }
  return [...seen];
}

/** US-TEAM-19 — a member row as an Owner sees it on Users. */
export interface MemberTeamRef {
  id: string;
  name: string;
}

/** US-TEAM-20 — what a member can open: their role, Teams and the same effective list the API enforces. */
export interface MemberAccess {
  role: "owner" | "staff" | "field";
  teams: MemberTeamRef[];
  capabilities: Record<string, boolean>;
}

/** US-TEAM-24 (D-233) — an Owner sets a Staff or Field member's password; they choose their own at next sign-in. */
export const setMemberPasswordSchema = z.object({
  newPassword: z.string().min(1).max(128),
});

/** US-TEAM-24 — the person's own choice after an Owner set it; no current password asked, the session proves it. */
export const choosePasswordSchema = z.object({
  newPassword: z.string().min(1).max(128),
});
