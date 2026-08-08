"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { AppShell, AppShellContent, AppShellSidebar, type AppShellNavSection } from "@spine/ui";
import { AppUserMenu } from "./app-user-menu";
import { NotificationBell } from "./notification-bell";

const COLLAPSE_STORAGE_KEY = "spine.sidebar.collapsed";

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
 * `NotificationBell` (PRD S-10.11) is placed here, in the sidebar footer
 * above `AppUserMenu`, deliberately — it's the ONLY persistent, always-
 * visible chrome in the app (confirmed before adding it: `AppShell`/
 * `AppShellContent` render per-page content that scrolls away entirely;
 * there is no app-wide top bar to put it in instead), so this is the one
 * place a bell icon can live once and appear on every authenticated page.
 */
export function AppLayout({ sections, userName, userEmail, children }: AppLayoutProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

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
          <div className="flex flex-col gap-1">
            <NotificationBell collapsed={hydrated ? collapsed : false} />
            <AppUserMenu name={userName} email={userEmail} collapsed={hydrated ? collapsed : false} />
          </div>
        }
      />
      <AppShellContent>{children}</AppShellContent>
    </AppShell>
  );
}
