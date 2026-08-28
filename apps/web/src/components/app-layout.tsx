"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { AppShell, AppShellContent, AppShellSidebar, type AppShellNavSection } from "@spine/ui";
import { AppUserMenu } from "./app-user-menu";
import { HelpButton } from "./help-button";
import { NotificationBell } from "./notification-bell";
import { CapabilitiesProvider } from "../lib/capabilities-context";

const COLLAPSE_STORAGE_KEY = "spine.sidebar.collapsed";

// Routes that opt out of AppShellContent's default 1200px reading-width cap
// — wide-by-nature content (a multi-column board or a scheduling calendar,
// not a form/prose page) where the cap would only waste space.
const FULL_WIDTH_ROUTES = ["/leads", "/meetings"];

function AppLogo({ collapsed }: { collapsed: boolean }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Avoid a hydration mismatch on the theme-dependent src by rendering the
  // light-mode asset until mounted, matching ThemeToggle's own pattern.
  const src = mounted && resolvedTheme === "dark" ? "/spine-logo-horizontal-light.png" : "/spine-logo-horizontal.png";

  if (collapsed) {
    return <span className="text-[16px] font-bold text-primary">S</span>;
  }
  return <Image src={src} alt="Spine" width={92} height={24} priority />;
}

export interface AppLayoutProps {
  sections: AppShellNavSection[];
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}

/**
 * The shared chrome every signed-in page renders inside — sidebar (logo,
 * nav sections, notification bell + user menu) + scrollable content region.
 * Owns the collapse/expand state (persisted to localStorage, matching the
 * pattern ThemeToggle/next-themes already use for cross-navigation
 * persistence) since that's presentation state specific to this web app,
 * not something @spine/ui's AppShell primitives need to know about.
 *
 * `NotificationBell` (PRD S-10.11) and `HelpButton` live here, in the
 * sidebar footer beside `AppUserMenu`, deliberately — it's the ONLY
 * persistent, always-visible chrome in the app (confirmed before adding it:
 * `AppShell`/`AppShellContent` render per-page content that scrolls away
 * entirely; there is no app-wide top bar to put it in instead), so this is
 * the one place these icons can live once and appear on every authenticated
 * page. Expanded: help + notifications sit in a row to the right of the
 * profile row. Collapsed: help, notifications, and the profile avatar stack
 * vertically, help on top.
 */
export function AppLayout({ sections, userName, userEmail, children }: AppLayoutProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const fullWidth = FULL_WIDTH_ROUTES.some((route) => pathname === route || pathname?.startsWith(`${route}/`));

  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
    setHydrated(true);
  }, []);

  function handleCollapsedChange(next: boolean) {
    setCollapsed(next);
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
  }

  return (
    <CapabilitiesProvider>
      <AppShell>
        <AppShellSidebar
          logo={<AppLogo collapsed={collapsed} />}
          collapsed={hydrated ? collapsed : false}
          onCollapsedChange={handleCollapsedChange}
          sections={sections}
          isActive={(href) => pathname === href || pathname?.startsWith(`${href}/`)}
          renderLink={(item, content) => (
            <Link href={item.href} aria-label={item.label}>
              {content}
            </Link>
          )}
          userMenu={
            (hydrated ? collapsed : false) ? (
              <div className="flex flex-col items-center gap-1">
                <HelpButton collapsed />
                <NotificationBell collapsed />
                <AppUserMenu name={userName} email={userEmail} collapsed />
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <AppUserMenu name={userName} email={userEmail} collapsed={false} />
                </div>
                <HelpButton collapsed={false} />
                <NotificationBell collapsed={false} />
              </div>
            )
          }
        />
        <AppShellContent fullWidth={fullWidth}>{children}</AppShellContent>
      </AppShell>
    </CapabilitiesProvider>
  );
}
