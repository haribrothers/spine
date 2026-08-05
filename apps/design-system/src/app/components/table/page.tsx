"use client";

import { StatusChip, Table } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

interface InvoiceRow {
  number: string;
  contact: string;
  total: number;
  status: "paid" | "due-soon" | "overdue" | "draft";
}

const rows: InvoiceRow[] = [
  { number: "INV-2026-0042", contact: "Acme Contracting Ltd.", total: 1240, status: "paid" },
  { number: "INV-2026-0043", contact: "Brightline Interiors", total: 890, status: "due-soon" },
  { number: "INV-2026-0044", contact: "Coastal Fabrication Co.", total: 3120, status: "overdue" },
  { number: "INV-2026-0045", contact: "Delta Electrical Services", total: 450, status: "draft" },
];

export default function TablePage() {
  return (
    <div>
      <DocTitle>Table</DocTitle>
      <DocLead>
        Zero-radius, dense row height, sticky header, sortable columns, client-side pagination
        — the primary vehicle for quote/invoice line items and the AR/AP aging report.
      </DocLead>

      <DocSection id="default" title="Default">
        <ComponentPreview
          code={`<Table
  rowKey={(row) => row.number}
  columns={[
    { key: "number", header: "Invoice", render: (row) => row.number, sortValue: (row) => row.number },
    { key: "contact", header: "Contact", render: (row) => row.contact, sortValue: (row) => row.contact },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (row) => \`$\${row.total.toFixed(2)}\`,
      sortValue: (row) => row.total,
    },
    { key: "status", header: "Status", render: (row) => <StatusChip status={row.status}>{row.status}</StatusChip> },
  ]}
  data={rows}
/>`}
        >
          <Table<InvoiceRow>
            rowKey={(row) => row.number}
            columns={[
              { key: "number", header: "Invoice", render: (row) => row.number, sortValue: (row) => row.number },
              { key: "contact", header: "Contact", render: (row) => row.contact, sortValue: (row) => row.contact },
              {
                key: "total",
                header: "Total",
                align: "right",
                render: (row) => `$${row.total.toFixed(2)}`,
                sortValue: (row) => row.total,
              },
              {
                key: "status",
                header: "Status",
                render: (row) => <StatusChip status={row.status}>{row.status}</StatusChip>,
              },
            ]}
            data={rows}
          />
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
