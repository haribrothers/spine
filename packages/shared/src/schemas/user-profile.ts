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
