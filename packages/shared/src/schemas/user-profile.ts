import { z } from "zod";

/** S-10.17 — self-service profile editing, available to every role. */
/** US-AUTH-18 (D-236): email changes go through `changeEmailSchema`, with the password. */
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    image: z.string().url().nullable().optional(),
  })
  .strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  /** US-AUTH-17 — sign out every other session too (on unless unticked). */
  signOutOthers: z.boolean().optional(),
});

/** US-AUTH-18 — a new sign-in email needs the current password. */
export const changeEmailSchema = z.object({
  newEmail: z.string().trim().toLowerCase().email("Enter an email address like name@example.com."),
  currentPassword: z.string().min(1, "Enter your current password."),
});

/** US-AUTH-17 — one place this account is signed in. */
export interface AccountSession {
  id: string;
  device: string;
  ipAddress: string | null;
  lastActiveAt: string;
  createdAt: string;
  current: boolean;
}

/** US-AUTH-17 — "Chrome on macOS", "Spine app on iPhone", from a session's user agent. */
export function deviceName(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  if (!ua) return "Unknown device";
  const app = /SpineApp|Expo|okhttp|CFNetwork|Darwin\//i.test(ua) && !/Mozilla/i.test(ua);
  const os = /iPhone/i.test(ua) ? "iPhone" : /iPad/i.test(ua) ? "iPad" : /Android|okhttp/i.test(ua) ? "Android" : /Mac OS X|Macintosh/i.test(ua) ? "macOS" : /Windows/i.test(ua) ? "Windows" : /CrOS/i.test(ua) ? "ChromeOS" : /Linux/i.test(ua) ? "Linux" : /CFNetwork|Darwin/i.test(ua) ? "iPhone" : null;
  if (app) return `Spine app on ${os ?? "a phone"}`;
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "A browser";
  return os ? `${browser} on ${os}` : browser;
}

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
