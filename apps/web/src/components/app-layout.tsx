"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { FileText, HardHat, House, Menu, Search, Wallet } from "lucide-react";
import { ActionBarSlot, AppShell, AppShellAreaNav, AppShellContent, AppShellPhoneBar, AppShellSidebar, BottomTabBar, SpineLogo, type BottomTabBarItem } from "@spine/ui";
import { AppUserMenu } from "./app-user-menu";
import { HelpButton } from "./help-button";
import { MoreSheet } from "./more-sheet";
import { SearchButton, SearchPalette } from "./search-palette";
import { RecentVisits } from "../lib/recent-visits";
import { NotificationBell } from "./notification-bell";
import { StorageBanner } from "./storage-banner";
import { BackupBanner } from "./backup-banner";
import { UpdateBanner } from "./update-banner";
import { CapabilitiesProvider, useCapabilities } from "../lib/capabilities-context";
import { ModulesProvider, useModules } from "../lib/modules-context";
import { ModuleOff } from "./module-off";
import { moduleForPage } from "@spine/shared";
import { navSectionsFor } from "../lib/nav-sections";
import { pageAccessFor } from "../lib/page-access";
import { areaFor, areaHref, areaPages, isBuilder, isTopLevel, parentPath, rememberAreaPage, titleFor, visibleAreas, type AreaKey } from "../lib/phone-shell";
import { PhoneBarProvider, usePhoneBarSlot } from "../lib/phone-bar";
import { RoleProvider } from "../lib/role-context";
import { NoAccess } from "./no-access";
import { PermissionToast } from "./permission-toast";
import { SessionExpiredDialog } from "./session-expired-dialog";
import { ToastHost } from "./toast-host";
import { SettingsRoute } from "./settings-route";
import { AccountProvider } from "../lib/account-context";
import { useIsPhone } from "../lib/use-is-phone";
import { useT } from "../lib/i18n";

const COLLAPSE_STORAGE_KEY = "spine.sidebar.collapsed";
/** US-OPS-54: a list's scroll, kept so the back arrow returns to the same place. */
const SCROLL_KEY = "spine.phone.scroll.";

// Routes that opt out of AppShellContent's default 1200px reading-width cap
// — wide-by-nature content (a multi-column board or a scheduling calendar,
// not a form/prose page) where the cap would only waste space.
const FULL_WIDTH_ROUTES = ["/leads", "/meetings"];

const TAB_LABELS = {
  home: "common.phone.tabs.home",
  sales: "common.phone.tabs.sales",
  jobs: "common.phone.tabs.jobs",
  money: "common.phone.tabs.money",
  more: "common.phone.tabs.more",
} as const satisfies Record<AreaKey, string>;

const TAB_ICONS: Record<AreaKey, React.ReactNode> = {
  home: <House aria-hidden />,
  sales: <FileText aria-hidden />,
  jobs: <HardHat aria-hidden />,
  money: <Wallet aria-hidden />,
  more: <Menu aria-hidden />,
};

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
 * The shared chrome every signed-in page renders inside. From 768px up: the
 * sidebar (logo, search, nav sections, notifications, help and the user menu)
 * beside the scrollable content. Under 768px (US-OPS-54, D-283): a top bar
 * with the page's title, a back arrow, search and notifications; an area's
 * pages in a row under it; and tabs along the bottom (Home · Sales · Jobs ·
 * Money · More), with More opening the whole menu as a sheet. Both come from
 * the same `navSectionsFor`, so a page hidden from one is hidden from the other.
 */
export function AppLayout(props: AppLayoutProps) {
  return (
    <RoleProvider value={props.role}>
      <CapabilitiesProvider>
        {/* US-OPS-38 (D-223): the one toast host, mounted across pages. */}
        <ToastHost max={3} duration={5000}>
          {/* US-AUTH-16: the person, and their saved theme, for every page. */}
          <AccountProvider>
            <ModulesProvider>
              {/* US-OPS-54: a page's one action in the phone top bar (Select, Done). */}
              <PhoneBarProvider>
                <AppLayoutShell {...props} />
              </PhoneBarProvider>
              {/* US-SET-33: ?settings=<pane> opens Settings on any page. */}
              <Suspense>
                <SettingsRoute isOwner={props.isOwner} />
              </Suspense>
            </ModulesProvider>
          </AccountProvider>
          <PermissionToast />
        </ToastHost>
        <SessionExpiredDialog email={props.userEmail} />
      </CapabilitiesProvider>
    </RoleProvider>
  );
}

function AppLayoutShell({ role, userName, userEmail, isOwner, children }: AppLayoutProps) {
  const t = useT();
  const router = useRouter();
  const { capabilities } = useCapabilities();
  const { modules } = useModules();
  // US-SET-24: the sidebar waits for the module switches, so nothing appears late or vanishes.
  const sections = useMemo(() => (modules ? navSectionsFor(role, capabilities, modules) : []), [modules, role, capabilities]);
  const pathname = usePathname();
  const path = pathname ?? "/";
  // US-SET-24: a page of a switched-off module says so instead of loading.
  const offModule = modules ? moduleForPage(path) : null;
  // US-OPS-12: a page this person can't open is replaced by the no-access
  // page before it mounts, so none of its data is ever requested.
  const access = pageAccessFor(path, role, capabilities);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // US-OPS-22: the search palette, opened by ⌘K / Ctrl+K or the search button.
  const [searchOpen, setSearchOpen] = useState(false);
  const isPhone = useIsPhone();
  const pageAction = usePhoneBarSlot();
  const [moreOpen, setMoreOpen] = useState(false);
  const fullWidth = FULL_WIDTH_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));

  const shown = useMemo(() => new Set(sections.flatMap((section) => section.items.map((item) => item.href))), [sections]);
  const navLabels = useMemo(() => new Map(sections.flatMap((section) => section.items.map((item) => [item.href, item.label] as const))), [sections]);
  const area = areaFor(path);
  // Where each tab goes, read from storage after mount (the area's first page until then).
  const [tabHrefs, setTabHrefs] = useState<Partial<Record<AreaKey, string>>>({});
  // True once Spine itself has navigated, so the back arrow can use the history.
  const navigated = useRef(false);
  const firstPath = useRef(path);
  const mainRef = useRef<HTMLElement>(null);
  const popped = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
    setHydrated(true);
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Following a link (or going back) closes the More sheet, remembers the area's page and
  // restores a list's scroll when coming back to it.
  useEffect(() => {
    setMoreOpen(false);
    if (path !== firstPath.current) navigated.current = true;
    rememberAreaPage(path, window.location.search);
    setTabHrefs(Object.fromEntries(visibleAreas(shown, role).map((key) => [key, areaHref(key, shown)])));
    const main = mainRef.current;
    const key = SCROLL_KEY + path + window.location.search;
    if (popped.current && main) {
      popped.current = false;
      const top = Number(window.sessionStorage.getItem(key) ?? 0);
      // The list loads after the page does: try again until it's tall enough.
      let tries = 0;
      const restore = () => {
        main.scrollTop = top;
        if (main.scrollTop < top && tries++ < 20) window.setTimeout(restore, 50);
      };
      restore();
    }
    const save = () => {
      try {
        window.sessionStorage.setItem(key, String(main?.scrollTop ?? 0));
      } catch {
        // No storage: back still works, at the top of the list.
      }
    };
    main?.addEventListener("scroll", save, { passive: true });
    return () => main?.removeEventListener("scroll", save);
  }, [path, shown, role]);

  const isActive = (href: string) => path === href || path.startsWith(`${href}/`);
  // US-SITE-11: the Help menu names the page its guide is for.
  const pageName = sections.flatMap((section) => section.items).find((item) => isActive(item.href))?.label;
  const renderLink = (item: { href: string; label: string }, content: React.ReactNode) => (
    <Link href={item.href} aria-label={item.label}>
      {content}
    </Link>
  );

  function handleCollapsedChange(next: boolean) {
    setCollapsed(next);
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
  }

  function goBack() {
    // Back through Spine's own history when there is some; from a link or a fresh tab, to the page above.
    if (navigated.current && window.history.length > 1) router.back();
    else router.push(parentPath(path));
  }

  const tabs: BottomTabBarItem[] = visibleAreas(shown, role).map((key) => ({
    key,
    href: tabHrefs[key] ?? (key === "more" ? "#" : key === "home" ? "/dashboard" : (areaPages(key, shown)[0] ?? "/dashboard")),
    label: t(TAB_LABELS[key]),
    icon: TAB_ICONS[key],
    current: moreOpen ? key === "more" : area === key,
  }));
  const rowPages = area === "sales" || area === "money" ? areaPages(area, shown) : [];
  const showRow = rowPages.includes(path);

  return (
    <AppShell>
      {isPhone ? (
        <>
          <AppShellPhoneBar
            title={titleFor(path, navLabels)}
            onBack={isTopLevel(path, shown) ? undefined : goBack}
            actions={
              <>
                {pageAction}
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label={t("common.search.label")}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Search size={22} aria-hidden />
                </button>
                <NotificationBell collapsed />
              </>
            }
          />
          {showRow ? (
            <AppShellAreaNav
              label={t(area === "sales" ? "common.nav.sections.sales" : "common.nav.sections.money")}
              items={rowPages.map((href) => ({ href, label: navLabels.get(href) ?? href, current: href === path }))}
              renderLink={(item, props) => (
                <Link href={item.href} className={props.className} aria-current={props["aria-current"]}>
                  {props.children}
                </Link>
              )}
            />
          ) : null}
        </>
      ) : (
        <AppShellSidebar
          logo={<AppLogo collapsed={collapsed} />}
          collapsed={hydrated ? collapsed : false}
          onCollapsedChange={handleCollapsedChange}
          sections={sections}
          isActive={isActive}
          renderLink={renderLink}
          search={<SearchButton collapsed={hydrated ? collapsed : false} onClick={() => setSearchOpen(true)} />}
          userMenu={
            (hydrated ? collapsed : false) ? (
              <div className="flex flex-col items-center gap-1">
                <HelpButton collapsed pageName={pageName} />
                <NotificationBell collapsed />
                <AppUserMenu name={userName} email={userEmail} collapsed isOwner={isOwner} />
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <AppUserMenu name={userName} email={userEmail} collapsed={false} isOwner={isOwner} />
                </div>
                <HelpButton collapsed={false} pageName={pageName} />
                <NotificationBell collapsed={false} />
              </div>
            )
          }
        />
      )}
      <AppShellContent
        ref={mainRef}
        fullWidth={fullWidth}
        banner={
          isOwner ? (
            <>
              <StorageBanner />
              <BackupBanner />
              <UpdateBanner />
            </>
          ) : null
        }
      >
        {offModule && modules && !modules[offModule] ? (
          <ModuleOff module={offModule} />
        ) : access.state === "allowed" ? (
          children
        ) : access.state === "denied" ? (
          <NoAccess pageName={access.pageName} ownerOnly={access.ownerOnly} fixedRole={access.fixedRole} />
        ) : null}
      </AppShellContent>
      {/* US-OPS-58: a record's main action, in a bar above the tab bar. */}
      {isPhone ? <ActionBarSlot /> : null}
      {isPhone && !isBuilder(path) ? (
        <BottomTabBar
          items={tabs}
          buttonKeys={["more"]}
          renderLink={(item, props) => (
            <Link href={item.href} className={props.className} aria-current={props["aria-current"]}>
              {props.children}
            </Link>
          )}
          renderButton={(_item, props) => (
            <button type="button" className={props.className} aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}>
              {props.children}
            </button>
          )}
        />
      ) : null}
      {isPhone ? <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} sections={sections} isActive={isActive} userName={userName} userEmail={userEmail} isOwner={isOwner} /> : null}
      <Suspense>
        <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} sections={sections} isOwner={isOwner} />
        {/* US-OPS-39: records opened, for search's Recent. */}
        <RecentVisits />
      </Suspense>
    </AppShell>
  );
}
