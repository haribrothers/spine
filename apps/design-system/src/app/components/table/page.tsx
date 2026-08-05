"use client";

import { StatusChip, Table } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

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
        — the primary vehicle for quote/invoice line items and the AR/AP aging report. See
        DataTable for the richer variant with a search box and column-visibility toggle.
      </DocLead>

      <ComponentPreview>
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

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Column-level sorting via a sortValue accessor — click a header to toggle ascending/descending/off.",
            "Automatic client-side pagination once data exceeds pageSize.",
            "Sticky header row stays visible while scrolling a tall table.",
            "Alternating hover tint on rows.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Table } from "@spine/ui";

export default () => (
  <Table
    columns={[{ key: "name", header: "Name", render: (row) => row.name }]}
    data={rows}
    rowKey={(row) => row.id}
  />
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "columns", type: "TableColumn<T>[]" },
            { prop: "data", type: "T[]" },
            { prop: "rowKey", type: "(row: T) => string" },
            { prop: "pageSize", type: "number", defaultValue: "20" },
          ]}
          caption="TableColumn<T>"
        />
        <ApiTable
          rows={[
            { prop: "key", type: "string" },
            { prop: "header", type: "string" },
            { prop: "render", type: "(row: T) => ReactNode" },
            { prop: "sortValue", type: "(row: T) => string | number | bigint" },
            { prop: "align", type: "left | right", defaultValue: "left" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
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

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Uses a native{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{"<table>"}</code>{" "}
          with proper <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{"<th>"}</code>{" "}
          header cells, so row/column relationships are announced correctly by screen readers.
          Sort buttons are real{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{"<button>"}</code>{" "}
          elements, keyboard-activatable.
        </DocLead>
      </DocSection>
    </div>
  );
}
