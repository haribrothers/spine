import { redirect } from "next/navigation";
import { AppLayout } from "../../components/app-layout";
import { getMyMembership } from "../../lib/get-my-membership";
import { getSession } from "../../lib/get-session";
import { getOrgLocale } from "../../lib/get-org-locale";
import { MoneyLocaleProvider } from "../../components/money-locale-provider";
import { OrgThemePreset } from "../../components/org-theme-preset";
import { getOrgThemePreset } from "../../lib/get-org-theme-preset";
import { t } from "../../lib/i18n";

/**
 * Shared chrome for every authenticated page (dashboard, quotes, contacts,
 * catalog) — a Next.js layout, not a per-page wrapper, so the sidebar stays
 * mounted across navigations instead of remounting on every page load. That
 * matters because AppLayout's collapse state is read from localStorage in a
 * post-mount effect (`hydrated`): remounting it on every nav briefly forced
 * `collapsed` back to false, producing an expand/collapse flicker each time
 * — moving it here (mounted once by Next.js, not once per page.tsx) fixes
 * that at the root instead of patching around it. Session is fetched once
 * here rather than duplicated in every page.tsx.
 */
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const [session, membership, locale, themePreset] = await Promise.all([getSession(), getMyMembership(), getOrgLocale(), getOrgThemePreset()]);
  // US-TEAM-24 (D-233): an Owner set this password — they choose their own before anything else.
  if (membership?.mustChangePassword) redirect("/choose-password");
  return (
    <MoneyLocaleProvider locale={locale}>
      <OrgThemePreset preset={themePreset} />
      <AppLayout
        role={membership?.role ?? null}
        userName={session?.user?.name ?? t("common.app.signedIn")}
        userEmail={session?.user?.email ?? ""}
        isOwner={membership?.role === "owner"}
      >
        {children}
      </AppLayout>
    </MoneyLocaleProvider>
  );
}
