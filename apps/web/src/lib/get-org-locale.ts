import { cookies } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * US-OPS-24 — the organisation's locale (Settings › Currency & locale),
 * read server-side the same way as get-my-membership.ts. "en-US" when it
 * isn't set or can't be read.
 */
export async function getOrgLocale(): Promise<string> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return "en-US";
  try {
    const res = await fetch(`${API_URL}/org/settings/currency`, { headers: { cookie: cookieHeader }, cache: "no-store" });
    if (!res.ok) return "en-US";
    const body = (await res.json()) as { value?: { locale?: string } | null };
    return body.value?.locale || "en-US";
  } catch {
    return "en-US";
  }
}
