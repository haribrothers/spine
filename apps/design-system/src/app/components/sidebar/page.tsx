"use client";

import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarNavItem } from "@spine/ui";
import { FileText, LayoutDashboard, Receipt, Users } from "lucide-react";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

function SidebarDemo() {
  const [active, setActive] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Sidebar collapsed={collapsed} className="h-80">
      <SidebarHeader
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        logo={<span className="truncate text-[14px] font-semibold text-on-surface">{collapsed ? "S" : "Spine"}</span>}
      />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel collapsed={collapsed}>Overview</SidebarGroupLabel>
          <SidebarNavItem
            icon={<LayoutDashboard />}
            active={active === "dashboard"}
            collapsed={collapsed}
            onClick={() => setActive("dashboard")}
          >
            Dashboard
          </SidebarNavItem>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel collapsed={collapsed}>Sales</SidebarGroupLabel>
          <SidebarNavItem icon={<FileText />} active={active === "quotes"} collapsed={collapsed} onClick={() => setActive("quotes")}>
            Quotes
          </SidebarNavItem>
          <SidebarNavItem icon={<Receipt />} active={active === "invoices"} collapsed={collapsed} onClick={() => setActive("invoices")}>
            Invoices
          </SidebarNavItem>
          <SidebarNavItem icon={<Users />} active={active === "contacts"} collapsed={collapsed} onClick={() => setActive("contacts")}>
            Contacts
          </SidebarNavItem>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {!collapsed && <span className="text-[12px] text-on-surface-muted">Signed in as owner</span>}
      </SidebarFooter>
    </Sidebar>
  );
}

export default function SidebarPage() {
  return (
    <div>
      <DocTitle>Sidebar</DocTitle>
      <DocLead>
        The reusable container behind an admin app's collapsible sidebar shell, per
        docs/DESIGN.md — a header slot (logo + collapse toggle), grouped SidebarNavItem lists,
        collapsible to an icon-only rail, with an optional footer slot (user menu). New
        admin-style screens should compose this rather than re-deriving the sidebar shell per
        app.
      </DocLead>

      <ComponentPreview>
        <SidebarDemo />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "A collapsed prop switches to a 64px icon-only rail; SidebarNavItem and SidebarGroupLabel hide their label automatically in that state.",
            "SidebarHeader renders a built-in logo + collapse-toggle row when given a logo and/or onCollapsedChange — pass children instead for a fully custom header.",
            "Disabled nav items render greyed-out and non-interactive rather than being omitted, per the existing AppShell convention.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarNavItem, SidebarFooter } from "@spine/ui";

export default () => (
  <Sidebar collapsed={collapsed}>
    <SidebarHeader collapsed={collapsed} onCollapsedChange={setCollapsed} logo={<Logo />} />
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel collapsed={collapsed} />
        <SidebarNavItem icon={<Icon />} collapsed={collapsed} />
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter />
  </Sidebar>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "Sidebar.collapsed", type: "boolean", defaultValue: "false" },
            { prop: "SidebarHeader.logo", type: "ReactNode" },
            { prop: "SidebarHeader.collapsed", type: "boolean", defaultValue: "false" },
            { prop: "SidebarHeader.onCollapsedChange", type: "(collapsed: boolean) => void" },
            { prop: "SidebarGroupLabel.collapsed", type: "boolean", defaultValue: "false" },
            { prop: "SidebarNavItem.icon", type: "ReactNode" },
            { prop: "SidebarNavItem.active", type: "boolean", defaultValue: "false" },
            { prop: "SidebarNavItem.disabled", type: "boolean", defaultValue: "false" },
            { prop: "SidebarNavItem.collapsed", type: "boolean", defaultValue: "false" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default — click the collapse toggle in the header</DocLead>
        <ComponentPreview
          code={`<Sidebar collapsed={collapsed}>
  <SidebarHeader collapsed={collapsed} onCollapsedChange={setCollapsed} logo={<Logo />} />
  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupLabel collapsed={collapsed}>Overview</SidebarGroupLabel>
      <SidebarNavItem icon={<LayoutDashboard />} active collapsed={collapsed}>Dashboard</SidebarNavItem>
    </SidebarGroup>
  </SidebarContent>
</Sidebar>`}
        >
          <SidebarDemo />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Each SidebarNavItem sets aria-current="page" when active, and remains a real, focusable, keyboard-activatable button even when collapsed to icon-only. The collapse toggle button carries an aria-label ("Expand sidebar" / "Collapse sidebar") since it's icon-only.</DocLead>
      </DocSection>
    </div>
  );
}
