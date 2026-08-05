"use client";

import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarNavItem } from "@spine/ui";
import { FileText, LayoutDashboard, Receipt, Users } from "lucide-react";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

function SidebarDemo() {
  const [active, setActive] = useState("dashboard");
  return (
    <Sidebar className="h-80">
      <SidebarHeader>
        <span className="text-[14px] font-semibold text-on-surface">Spine</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarNavItem icon={<LayoutDashboard />} active={active === "dashboard"} onClick={() => setActive("dashboard")}>
            Dashboard
          </SidebarNavItem>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Sales</SidebarGroupLabel>
          <SidebarNavItem icon={<FileText />} active={active === "quotes"} onClick={() => setActive("quotes")}>
            Quotes
          </SidebarNavItem>
          <SidebarNavItem icon={<Receipt />} active={active === "invoices"} onClick={() => setActive("invoices")}>
            Invoices
          </SidebarNavItem>
          <SidebarNavItem icon={<Users />} active={active === "contacts"} onClick={() => setActive("contacts")}>
            Contacts
          </SidebarNavItem>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <span className="text-[12px] text-on-surface-muted">Signed in as owner</span>
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

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "A collapsed prop switches to a 64px icon-only rail; SidebarNavItem hides its label automatically in that state.",
            "Disabled nav items render greyed-out and non-interactive rather than being omitted, per the existing AppShell convention.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarNavItem, SidebarFooter } from "@spine/ui";

export default () => (
  <Sidebar>
    <SidebarHeader />
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel />
        <SidebarNavItem icon={<Icon />} />
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
            { prop: "SidebarNavItem.icon", type: "ReactNode" },
            { prop: "SidebarNavItem.active", type: "boolean", defaultValue: "false" },
            { prop: "SidebarNavItem.disabled", type: "boolean", defaultValue: "false" },
            { prop: "SidebarNavItem.collapsed", type: "boolean", defaultValue: "false" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Sidebar>
  <SidebarHeader>Spine</SidebarHeader>
  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupLabel>Overview</SidebarGroupLabel>
      <SidebarNavItem icon={<LayoutDashboard />} active>Dashboard</SidebarNavItem>
    </SidebarGroup>
  </SidebarContent>
</Sidebar>`}
        >
          <SidebarDemo />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Each SidebarNavItem sets aria-current="page" when active, and remains a real, focusable, keyboard-activatable button even when collapsed to icon-only.</DocLead>
      </DocSection>
    </div>
  );
}
