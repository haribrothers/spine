"use client";

import { DataTable, StatusChip } from "@spine/ui";
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

export default function DataTablePage() {
  return (
    <div>
      <DocTitle>DataTable</DocTitle>
      <DocLead>
        Table plus a search box and a column-visibility toggle — the richer layer for a full
        data-management screen (e.g. the invoice list), where plain Table (sortable + paginated
        only) is enough for embedded contexts like a quote's line items.
      </DocLead>

      <ComponentPreview>
        <DataTable<InvoiceRow>
          rowKey={(row) => row.number}
          searchKey={(row) => row.contact}
          searchPlaceholder="Search by contact…"
          columns={[
            { key: "number", header: "Invoice", render: (row) => row.number },
            { key: "contact", header: "Contact", render: (row) => row.contact },
            { key: "total", header: "Total", align: "right", render: (row) => `$${row.total.toFixed(2)}` },
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
            "Client-side search filtering via a searchKey accessor.",
            "A Columns dropdown lets the user hide/show individual columns without losing sort state.",
            "Composes Table underneath rather than reimplementing row rendering.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { DataTable } from "@spine/ui";

export default () => (
  <DataTable
    columns={columns}
    data={data}
    rowKey={(row) => row.id}
    searchKey={(row) => row.contact}
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
            { prop: "searchKey", type: "(row: T) => string" },
            { prop: "searchPlaceholder", type: "string", defaultValue: '"Search…"' },
            { prop: "pageSize", type: "number" },
            { prop: "configurablePageSize", type: "boolean", defaultValue: "false" },
            { prop: "pageSizeOptions", type: "number[]", defaultValue: "[10, 25, 50, 100]" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<DataTable<InvoiceRow>
  rowKey={(row) => row.number}
  searchKey={(row) => row.contact}
  searchPlaceholder="Search by contact…"
  columns={[
    { key: "number", header: "Invoice", render: (row) => row.number },
    { key: "contact", header: "Contact", render: (row) => row.contact },
    { key: "total", header: "Total", align: "right", render: (row) => \`$\${row.total.toFixed(2)}\` },
    { key: "status", header: "Status", render: (row) => <StatusChip status={row.status}>{row.status}</StatusChip> },
  ]}
  data={rows}
/>`}
        >
          <DataTable<InvoiceRow>
            rowKey={(row) => row.number}
            searchKey={(row) => row.contact}
            searchPlaceholder="Search by contact…"
            columns={[
              { key: "number", header: "Invoice", render: (row) => row.number },
              { key: "contact", header: "Contact", render: (row) => row.contact },
              { key: "total", header: "Total", align: "right", render: (row) => `$${row.total.toFixed(2)}` },
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
        <DocLead>Inherits Table's semantic markup; the Columns dropdown checkboxes announce their checked state via DropdownMenuCheckboxItem.</DocLead>
      </DocSection>
    </div>
  );
}
