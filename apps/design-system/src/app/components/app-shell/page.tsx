"use client";

import {
  AppShell,
  AppShellContent,
  AppShellHeader,
  AppShellSidebar,
  Avatar,
  AvatarFallback,
  type AppShellNavSection,
} from "@spine/ui";
import { Bell, ChevronDown, FileText, HelpCircle, LayoutDashboard, Receipt, Settings, Users } from "lucide-react";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

const DEMO_SECTIONS: AppShellNavSection[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard /> }],
  },
  {
    label: "Sales",
    items: [
      { href: "/quotes", label: "Quotes", icon: <FileText /> },
      { href: "/invoices", label: "Invoices", icon: <Receipt /> },
      { href: "/contacts", label: "Contacts", icon: <Users /> },
    ],
  },
  {
    label: "Organisation",
    items: [{ href: "/settings", label: "Settings", icon: <Settings /> }],
  },
];

function AppShellDemo() {
  const [collapsed, setCollapsed] = useState(false);
  const [path, setPath] = useState("/dashboard");

  return (
    <div className="h-[560px] w-full overflow-hidden rounded-lg border border-border">
      <AppShell className="h-full">
        <AppShellSidebar
          logo={<span className="truncate text-[14px] font-semibold text-on-surface">{collapsed ? "S" : "Spine"}</span>}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          sections={DEMO_SECTIONS}
          isActive={(href) => path === href}
          renderLink={(item, content) => (
            <a
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                setPath(item.href);
              }}
              aria-label={item.label}
            >
              {content}
            </a>
          )}
          userMenu={
            collapsed ? (
              <div className="flex flex-col items-center gap-1">
                <button aria-label="Help" className="flex h-9 w-9 items-center justify-center rounded-sm text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface">
                  <HelpCircle size={16} />
                </button>
                <button aria-label="Notifications" className="flex h-9 w-9 items-center justify-center rounded-sm text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface">
                  <Bell size={16} />
                </button>
                <Avatar size="sm">
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1.5 py-1.5 text-left hover:bg-surface-sunken">
                  <Avatar size="sm">
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-on-surface">Jordan Diaz</span>
                  <ChevronDown size={14} className="shrink-0 text-on-surface-muted" />
                </button>
                <button aria-label="Help" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface">
                  <HelpCircle size={16} />
                </button>
                <button aria-label="Notifications" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface">
                  <Bell size={16} />
                </button>
              </div>
            )
          }
        />
        <AppShellContent>
          <AppShellHeader
            breadcrumb={[{ label: "Overview" }, { label: "Dashboard" }]}
            title="Good morning, Jordan"
            description="Here's what's happening across your business."
            action={
              <button className="rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-white">
                New quote
              </button>
            }
          />
          <p className="text-[13px] text-on-surface-muted">Page content renders here.</p>
        </AppShellContent>
      </AppShell>
    </div>
  );
}

export default function AppShellPage() {
  return (
    <div>
      <DocTitle>AppShell</DocTitle>
      <DocLead>
        The persistent shell every signed-in area of Spine renders inside — a collapsible left
        sidebar (logo, grouped nav sections, pinned user menu) plus a main content region with an
        optional breadcrumb + title + description + primary-action header. First applied to
        `/dashboard` and `/settings`, replacing Settings' previous standalone shell so both areas
        share one implementation instead of two.
      </DocLead>

      <ComponentPreview>
        <AppShellDemo />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Compound API — AppShell (frame), AppShellSidebar (nav rail), AppShellHeader (breadcrumb/title/description/action), AppShellContent (scrollable main region, capped to the 1200px container width by default) — composed per page rather than configured through one large props object.",
            "AppShellContent's fullWidth prop opts a page out of the 1200px cap for content that's wide by nature (a multi-column board, a dense table) rather than form/prose — the cap exists to keep reading-width content comfortable, and just wastes space on content designed to fill the screen.",
            "Nav content is entirely caller-supplied via a `sections` prop (grouped items with icon/label/href) — AppShell has no built-in opinion about which pages exist in a given app.",
            "Collapse toggle is real (built on Sidebar's existing collapsed state) and typically persisted by the consuming app (e.g. to localStorage) so it survives navigation — AppShell itself is stateless and takes `collapsed`/`onCollapsedChange` as controlled props.",
            "renderLink stays router-agnostic — pass a Next.js `<Link>` (or any anchor) so @spine/ui never depends on next/link directly.",
            "AppShellHeader's breadcrumb and action are optional — a page can render AppShellContent directly and build its own header if AppShellHeader doesn't fit.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { AppShell, AppShellSidebar, AppShellHeader, AppShellContent } from "@spine/ui";

export default () => (
  <AppShell>
    <AppShellSidebar
      logo={<Logo />}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      sections={sections}
      isActive={(href) => pathname === href}
      renderLink={(item, content) => <Link href={item.href}>{content}</Link>}
      userMenu={<UserMenu />}
    />
    <AppShellContent>
      <AppShellHeader
        breadcrumb={[{ label: "Overview" }, { label: "Dashboard" }]}
        title="Dashboard"
        description="..."
        action={<Button>New quote</Button>}
      />
      {/* page content */}
    </AppShellContent>
  </AppShell>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "AppShellSidebar.logo", type: "ReactNode" },
            { prop: "AppShellSidebar.collapsed", type: "boolean" },
            { prop: "AppShellSidebar.onCollapsedChange", type: "(collapsed: boolean) => void" },
            { prop: "AppShellSidebar.sections", type: "AppShellNavSection[]" },
            { prop: "AppShellSidebar.isActive", type: "(href: string) => boolean" },
            { prop: "AppShellSidebar.renderLink", type: "(item: AppShellNavItem, children: ReactNode) => ReactNode" },
            { prop: "AppShellSidebar.userMenu", type: "ReactNode" },
            { prop: "AppShellHeader.breadcrumb", type: "BreadcrumbItem[]" },
            { prop: "AppShellHeader.title", type: "string" },
            { prop: "AppShellHeader.description", type: "string" },
            { prop: "AppShellHeader.action", type: "ReactNode" },
            { prop: "AppShellContent.fullWidth", type: "boolean", defaultValue: "false", description: "Opts out of the default 1200px max-width cap." },
            { prop: "AppShellContent.banner", type: "ReactNode", defaultValue: "—", description: "App-wide Banners shown full-width above the page, outside the width cap." },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Collapse the sidebar and switch pages via the demo above — click a nav item or the collapse toggle.</DocLead>
        <ComponentPreview
          code={`<AppShellSidebar
  sections={[
    { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard /> }] },
  ]}
  isActive={(href) => pathname === href}
  renderLink={(item, content) => <Link href={item.href}>{content}</Link>}
/>`}
        >
          <AppShellDemo />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <FeatureList
          items={[
            "The sidebar nav rail is a landmark <aside> (via the underlying Sidebar primitive); nav sections and items are real, focusable, keyboard-activatable links (or buttons, when not using asChild) rather than clickable divs.",
            "SidebarNavItem sets aria-current=\"page\" on the active item, and — via the new `asChild` mode this component relies on — that state carries through onto the real anchor element AppShellSidebar's `renderLink` returns, not onto a wrapping button.",
            "The collapse toggle button (rendered by SidebarHeader) carries an aria-label (\"Expand sidebar\"/\"Collapse sidebar\") and reflects state visually via the icon swap; screen reader users get the label change, not just an icon change.",
            "The user menu is a Radix DropdownMenu under the hood, so it's keyboard-operable for free — Enter/Space opens it, arrow keys move between items, Escape closes it, and focus returns to the trigger on close.",
            "When collapsed, each nav item's visible label disappears but an aria-label (set from the item's `label`) stays on the link so its accessible name doesn't degrade to just an icon.",
          ]}
        />
      </DocSection>
    </div>
  );
}
