import { cookies } from "next/headers";
import { resolveThemePreset, type ThemePreset } from "@spine/shared";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * US-SET-09 — the organisation's theme preset (Settings › Branding), read
 * server-side the same way as get-org-locale.ts. Spine Blue when it isn't
 * set or can't be read.
 */
export async function getOrgThemePreset(): Promise<ThemePreset> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return resolveThemePreset(undefined);
  try {
    const res = await fetch(`${API_URL}/org/settings/branding`, { headers: { cookie: cookieHeader }, cache: "no-store" });
    if (!res.ok) return resolveThemePreset(undefined);
    const body = (await res.json()) as { value?: { themePreset?: unknown } | null };
    return resolveThemePreset(body.value?.themePreset);
  } catch {
    return resolveThemePreset(undefined);
  }
}
