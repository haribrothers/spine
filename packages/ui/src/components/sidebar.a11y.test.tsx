import { render } from "@testing-library/react";
import { FileText, LayoutDashboard, Receipt } from "lucide-react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarNavItem } from "./sidebar";

describe("Sidebar a11y", () => {
  it("has no violations expanded", async () => {
    const { container } = render(
      <Sidebar className="h-80">
        <SidebarHeader onCollapsedChange={() => {}} logo={<span className="text-[14px] font-semibold text-on-surface">Spine</span>} />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Overview</SidebarGroupLabel>
            <SidebarNavItem icon={<LayoutDashboard />} active>
              Dashboard
            </SidebarNavItem>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Sales</SidebarGroupLabel>
            <SidebarNavItem icon={<FileText />}>Quotes</SidebarNavItem>
            <SidebarNavItem icon={<Receipt />} disabled>
              Invoices
            </SidebarNavItem>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <span className="text-[12px] text-on-surface-muted">Signed in as owner</span>
        </SidebarFooter>
      </Sidebar>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations collapsed", async () => {
    const { container } = render(
      <Sidebar collapsed className="h-80">
        <SidebarHeader collapsed onCollapsedChange={() => {}} logo={<span className="text-[14px] font-semibold text-on-surface">S</span>} />
        <SidebarContent>
          <SidebarGroup collapsed>
            <SidebarGroupLabel collapsed>Overview</SidebarGroupLabel>
            <SidebarNavItem icon={<LayoutDashboard />} active collapsed>
              Dashboard
            </SidebarNavItem>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>,
    );
    await expectNoA11yViolations(container);
  });
});
