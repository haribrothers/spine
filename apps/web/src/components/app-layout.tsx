"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell, AppShellContent, AppShellSidebar, SpineLogo } from "@spine/ui";
import { AppUserMenu } from "./app-user-menu";
import { HelpButton } from "./help-button";
import { SearchButton, SearchPalette } from "./search-palette";
import { NotificationBell } from "./notification-bell";
import { StorageBanner } from "./storage-banner";
import { CapabilitiesProvider, useCapabilities } from "../lib/capabilities-context";
import { ModulesProvider, useModules } from "../lib/modules-context";
import { ModuleOff } from "./module-off";
import { moduleForPage } from "@spine/shared";
import { navSectionsFor } from "../lib/nav-sections";
import { pageAccessFor } from "../lib/page-access";
import { RoleProvider } from "../lib/role-context";
import { NoAccess } from "./no-access";
import { PermissionToast } from "./permission-toast";
import { SessionExpiredDialog } from "./session-expired-dialog";
import { ToastHost } from "./toast-host";

const COLLAPSE_STORAGE_KEY = "spine.sidebar.collapsed";

// Routes that opt out of AppShellContent's default 1200px reading-width cap
// — wide-by-nature content (a multi-column board or a scheduling calendar,
// not a form/prose page) where the cap would only waste space.
const FULL_WIDTH_ROUTES = ["/leads", "/meetings"];

/**
 * US-SET-26 (D-206) — the horizontal logo, or the gradient mark alone when
 * the sidebar is collapsed. Dark mode comes from CSS, so it's right from the
 * first frame.
 */
function AppLogo({ collapsed }: { collapsed: boolean }) {
  return collapsed ? <SpineLogo variant="mark" size={28} /> : <SpineLogo variant="horizontal" size={96} />;
}

export interface AppLayoutProps {
  /** The member's role, resolved server-side; the sidebar is filtered from it and their capabilities (US-TEAM-18). */
  role: string | null;
  userName: string;
  userEmail: string;
  /** CLAUDE.md — "org settings" is Owner-only, never Team-configurable. Sourced server-side (AuthenticatedLayout's getMyMembership) rather than trusting a client-supplied role, same trust boundary the Team nav section already uses. */
  isOwner: boolean;
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
export function AppLayout(props: AppLayoutProps) {
  return (
    <RoleProvider value={props.role}>
      <CapabilitiesProvider>
        {/* US-OPS-38 (D-223): the one toast host, mounted across pages. */}
        <ToastHost max={3} duration={5000}>
          <ModulesProvider>
            <AppLayoutShell {...props} />
          </ModulesProvider>
          <PermissionToast />
        </ToastHost>
        <SessionExpiredDialog email={props.userEmail} />
      </CapabilitiesProvider>
    </RoleProvider>
  );
}

function AppLayoutShell({ role, userName, userEmail, isOwner, children }: AppLayoutProps) {
  const { capabilities } = useCapabilities();
  const { modules } = useModules();
  // US-SET-24: the sidebar waits for the module switches, so nothing appears late or vanishes.
  const sections = modules ? navSectionsFor(role, capabilities, modules) : [];
  const pathname = usePathname();
  // US-SET-24: a page of a switched-off module says so instead of loading.
  const offModule = modules ? moduleForPage(pathname ?? "") : null;
  // US-OPS-12: a page this person can't open is replaced by the no-access
  // page before it mounts, so none of its data is ever requested.
  const access = pageAccessFor(pathname ?? "", role, capabilities);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // US-OPS-22: the search palette, opened by ⌘K / Ctrl+K or the search button.
  const [searchOpen, setSearchOpen] = useState(false);
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
              <SearchButton onClick={() => setSearchOpen(true)} />
              <HelpButton collapsed />
              <NotificationBell collapsed />
              <AppUserMenu name={userName} email={userEmail} collapsed isOwner={isOwner} />
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <AppUserMenu name={userName} email={userEmail} collapsed={false} isOwner={isOwner} />
              </div>
              <SearchButton onClick={() => setSearchOpen(true)} />
              <HelpButton collapsed={false} />
              <NotificationBell collapsed={false} />
            </div>
          )
        }
      />
      <AppShellContent fullWidth={fullWidth} banner={isOwner ? <StorageBanner /> : null}>
        {offModule && modules && !modules[offModule] ? (
          <ModuleOff module={offModule} />
        ) : access.state === "allowed" ? (
          children
        ) : access.state === "denied" ? (
          <NoAccess pageName={access.pageName} ownerOnly={access.ownerOnly} fixedRole={access.fixedRole} />
        ) : null}
      </AppShellContent>
      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </AppShell>
  );
}
