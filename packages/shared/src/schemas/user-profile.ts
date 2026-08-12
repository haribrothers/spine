import { z } from "zod";

/** S-10.17 — self-service profile editing, available to every role. */
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().optional(),
  image: z.string().url().nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const themePreferenceSchema = z.enum(["system", "light", "dark"]);

export const updatePreferencesSchema = z.object({
  themePreference: themePreferenceSchema,
});

/**
 * S-10.22 — per-user override of the org's default meeting-reminder lead
 * time. `null` explicitly clears the override back to "use the org
 * default" (same nullable-means-fall-back convention as
 * `user.dashboardLayout`) — a dedicated endpoint, not folded into
 * `updatePreferencesSchema` above, mirroring how `dashboardLayout` already
 * has its own `PUT /users/me/dashboard-layout` rather than sharing
 * `me/preferences`'s always-required-field contract.
 */
export const updateMeetingReminderLeadMinutesSchema = z.object({
  meetingReminderLeadMinutes: z.number().int().min(0).nullable(),
});
