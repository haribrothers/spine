import { redirect } from "next/navigation";

/** The old Profile & Preferences tabs, as Settings › Your account panes (US-SET-30, D-236). */
const PANES: Record<string, string> = { profile: "profile", password: "security", appearance: "profile", notifications: "notifications" };

/**
 * US-SET-30 — Profile & Preferences is now Settings › Your account; links to
 * `/profile` (and `?tab=`) open Settings on the matching pane.
 */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  redirect(`/dashboard?settings=${PANES[tab ?? ""] ?? "profile"}`);
}
