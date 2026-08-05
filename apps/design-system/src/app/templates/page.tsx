"use client";

import {
  Avatar,
  AvatarFallback,
  Breadcrumb,
  Button,
  EmptyState,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarNavItem,
  StatCard,
  StatusChip,
  Table,
} from "@spine/ui";
import { FileText, Inbox, LayoutDashboard, Receipt, Users } from "lucide-react";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

interface InvoiceRow {
  number: string;
  contact: string;
  total: string;
  status: "paid" | "due-soon" | "overdue" | "draft";
}

const invoices: InvoiceRow[] = [
  { number: "INV-2026-0042", contact: "Acme Contracting Ltd.", total: "$1,240.00", status: "paid" },
  { number: "INV-2026-0043", contact: "Brightline Interiors", total: "$890.00", status: "due-soon" },
  { number: "INV-2026-0044", contact: "Coastal Fabrication Co.", total: "$3,120.00", status: "overdue" },
];

function AdminDashboardTemplate() {
  return (
    <div className="flex h-[520px] overflow-hidden rounded-lg border border-border">
      <Sidebar className="h-full">
        <SidebarHeader>
          <span className="text-[14px] font-semibold text-on-surface">Spine</span>
        </SidebarHeader>
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
            <SidebarNavItem icon={<Receipt />}>Invoices</SidebarNavItem>
            <SidebarNavItem icon={<Users />}>Contacts</SidebarNavItem>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-2">
            <Avatar size="sm">
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <span className="text-[12px] text-on-surface-muted">Jordan Diaz</span>
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="flex-1 overflow-y-auto p-6">
        <Breadcrumb items={[{ label: "Dashboard" }]} className="mb-4" />
        <h1 className="mb-4 text-[24px] font-bold tracking-tight text-on-surface">Good morning, Jordan</h1>
        <div className="mb-6 grid grid-cols-3 gap-4">
          <StatCard label="Cash position" value="$48,210" trend={{ direction: "up", label: "+12% vs last month" }} />
          <StatCard label="Receivables" value="$12,430" trend={{ direction: "neutral", label: "3 overdue" }} />
          <StatCard label="This month's revenue" value="$26,100" trend={{ direction: "up", label: "+8%" }} />
        </div>
        <h2 className="mb-2 text-[16px] font-semibold text-on-surface">Recent invoices</h2>
        <Table<InvoiceRow>
          rowKey={(row) => row.number}
          columns={[
            { key: "number", header: "Invoice", render: (row) => row.number },
            { key: "contact", header: "Contact", render: (row) => row.contact },
            { key: "total", header: "Total", align: "right", render: (row) => row.total },
            {
              key: "status",
              header: "Status",
              render: (row) => <StatusChip status={row.status}>{row.status}</StatusChip>,
            },
          ]}
          data={invoices}
        />
      </div>
    </div>
  );
}

function EmptyDashboardTemplate() {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-border">
      <EmptyState
        icon={<Inbox />}
        title="No quotes yet"
        description="Create your first quote to start the enquiry-to-invoice workflow."
        action={
          <Button className="inline-flex items-center gap-1.5">
            <FileText size={16} />
            Create quote
          </Button>
        }
      />
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <div>
      <DocTitle>Templates</DocTitle>
      <DocLead>
        Full sample screens composed from real `@spine/ui` components, showing how the pieces
        fit together in an actual Spine page rather than in isolation. These use the Admin
        layout shell from docs/DESIGN.md's own Layouts section — a collapsible sidebar with
        grouped SidebarNavItems, and a main content area that starts directly with a page
        title rather than a separate top bar.
      </DocLead>

      <DocSection id="admin-dashboard" title="Admin dashboard">
        <DocLead>
          The reference shell every new admin screen (matrix builder, scheduling, user
          management, quote/invoice editors) should be built inside, not reinvented per-screen.
        </DocLead>
        <div className="my-4">
          <AdminDashboardTemplate />
        </div>
      </DocSection>

      <DocSection id="empty-dashboard" title="First-run / empty dashboard">
        <DocLead>
          Spine's onboarding principle applied to the dashboard itself — the app must never
          show a blank screen with no next action, per PRD §FEAT-12.
        </DocLead>
        <div className="my-4">
          <EmptyDashboardTemplate />
        </div>
      </DocSection>
    </div>
  );
}
