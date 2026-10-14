import { render, screen } from "@testing-library/react";
import { LayoutDashboard, Receipt } from "lucide-react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { AppShell, AppShellContent, AppShellHeader, AppShellSidebar, type AppShellNavSection } from "./app-shell";
import { Avatar, AvatarFallback } from "./avatar";

const DEMO_SECTIONS: AppShellNavSection[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard /> }],
  },
  {
    label: "Sales",
    items: [{ href: "/invoices", label: "Invoices", icon: <Receipt /> }],
  },
];

describe("AppShell a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <AppShell className="h-[400px]">
        <AppShellSidebar
          logo={<span className="text-[14px] font-semibold text-on-surface">Spine</span>}
          collapsed={false}
          onCollapsedChange={() => {}}
          sections={DEMO_SECTIONS}
          isActive={(href) => href === "/dashboard"}
          renderLink={(item, content) => (
            <a href={item.href} aria-label={item.label}>
              {content}
            </a>
          )}
          userMenu={
            <div className="flex items-center gap-2">
              <Avatar size="sm">
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <span className="text-[13px] font-medium text-on-surface">Jordan Diaz</span>
            </div>
          }
        />
        <AppShellContent>
          <AppShellHeader
            breadcrumb={[{ label: "Overview" }, { label: "Dashboard" }]}
            title="Good morning, Jordan"
            description="Here's what's happening across your business."
          />
          <p className="text-[13px] text-on-surface-muted">Page content renders here.</p>
        </AppShellContent>
      </AppShell>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations collapsed", async () => {
    const { container } = render(
      <AppShell className="h-[400px]">
        <AppShellSidebar
          logo={<span className="text-[14px] font-semibold text-on-surface">S</span>}
          collapsed
          onCollapsedChange={() => {}}
          sections={DEMO_SECTIONS}
          isActive={(href) => href === "/dashboard"}
          renderLink={(item, content) => (
            <a href={item.href} aria-label={item.label}>
              {content}
            </a>
          )}
        />
        <AppShellContent>
          <p className="text-[13px] text-on-surface-muted">Page content renders here.</p>
        </AppShellContent>
      </AppShell>,
    );
    await expectNoA11yViolations(container);
  });

  it("US-OPS-48: shows the search slot under the logo, before the nav", async () => {
    const { container } = render(
      <AppShell className="h-[400px]">
        <AppShellSidebar
          logo={<span className="text-[14px] font-semibold text-on-surface">Spine</span>}
          collapsed={false}
          onCollapsedChange={() => {}}
          sections={DEMO_SECTIONS}
          isActive={() => false}
          renderLink={(item, content) => (
            <a href={item.href} aria-label={item.label}>
              {content}
            </a>
          )}
          search={
            <button type="button" aria-label="Search" aria-keyshortcuts="Meta+K Control+K">
              Search…
            </button>
          }
        />
        <AppShellContent>
          <p>Content</p>
        </AppShellContent>
      </AppShell>,
    );
    const search = screen.getByRole("button", { name: "Search" });
    const firstLink = screen.getByRole("link", { name: "Dashboard" });
    expect(search.compareDocumentPosition(firstLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});
