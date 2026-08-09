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
