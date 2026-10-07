"use client";

import { Badge, StatusChip, Table } from "@spine/ui";
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

interface QuoteRow {
  id: string;
  rootQuoteId: string;
  number: string | null;
  version: number;
  contact: string;
  total: number;
  status: "draft" | "sent" | "accepted" | "rejected";
}

const quoteRows: QuoteRow[] = [
  { id: "q1", rootQuoteId: "fam-1", number: "QUO-0012", version: 1, contact: "Acme Contracting Ltd.", total: 4200, status: "rejected" },
  { id: "q2", rootQuoteId: "fam-1", number: "QUO-0012-R1", version: 2, contact: "Acme Contracting Ltd.", total: 3800, status: "accepted" },
  { id: "q3", rootQuoteId: "fam-2", number: "QUO-0013", version: 1, contact: "Brightline Interiors", total: 1560, status: "sent" },
  { id: "q4", rootQuoteId: "fam-3", number: null, version: 1, contact: "Coastal Fabrication Co.", total: 920, status: "draft" },
];

const QUOTE_STATUS_BADGE_CLASS: Record<QuoteRow["status"], string> = {
  draft: "bg-draft-bg text-draft",
  sent: "bg-due-soon-bg text-due-soon",
  accepted: "bg-paid-bg text-paid",
  rejected: "bg-overdue-bg text-overdue",
};

/** The newest version of a quote family renders as the group's primary/collapsed row. */
function quoteGroupPrimary(familyRows: QuoteRow[]): QuoteRow {
  return familyRows.reduce((newest, row) => (row.version > newest.version ? row : newest));
}

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
            "Set configurablePageSize to render a PaginationBar (rows-per-page select + summary) instead of a fixed pageSize.",
            "Sticky header row stays visible while scrolling a tall table.",
            "Alternating hover tint on rows.",
            "Set groupBy to cluster rows that share a key (e.g. every version of the same quote) into one expandable group instead of showing every row flat — sorting and pagination then operate over groups, not raw rows.",
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
            { prop: "configurablePageSize", type: "boolean", defaultValue: "false" },
            { prop: "pageSizeOptions", type: "number[]", defaultValue: "[10, 25, 50, 100]" },
            { prop: "groupBy", type: "(row: T) => string" },
            { prop: "groupPrimary", type: "(rows: T[]) => T" },
            { prop: "groupMemberLabel", type: "(row: T) => ReactNode" },
            { prop: "footer", type: "Partial<Record<string, ReactNode>>", description: "A totals row under every page, keyed by column key (a report's \"Total\"). Columns left out stay blank." },
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

        <DocLead>
          Grouped rows — every version of the same quote (Quotes' own revision history, §S-03.8)
          collapses into one row showing the newest version, with older/superseded versions
          expandable underneath via the chevron. Sorting and pagination operate over the three
          groups shown here, not the four underlying rows.
        </DocLead>
        <ComponentPreview
          code={`function groupPrimary(familyRows) {
  return familyRows.reduce((newest, row) => (row.version > newest.version ? row : newest));
}

<Table
  rowKey={(row) => row.id}
  columns={[
    { key: "number", header: "Number", render: (row) => row.number ?? "— (unsent draft)" },
    { key: "contact", header: "Contact", render: (row) => row.contact, sortValue: (row) => row.contact },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge className={STATUS_BADGE_CLASS[row.status]}>{row.status}</Badge>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (row) => \`$\${row.total.toFixed(2)}\`,
      sortValue: (row) => row.total,
    },
  ]}
  data={quoteRows}
  groupBy={(row) => row.rootQuoteId}
  groupPrimary={groupPrimary}
  groupMemberLabel={(row) => <Badge className="bg-transparent text-on-surface-muted">v{row.version}</Badge>}
/>`}
        >
          <Table<QuoteRow>
            rowKey={(row) => row.id}
            columns={[
              { key: "number", header: "Number", render: (row) => row.number ?? "— (unsent draft)" },
              { key: "contact", header: "Contact", render: (row) => row.contact, sortValue: (row) => row.contact },
              {
                key: "status",
                header: "Status",
                render: (row) => <Badge className={QUOTE_STATUS_BADGE_CLASS[row.status]}>{row.status}</Badge>,
              },
              {
                key: "total",
                header: "Total",
                align: "right",
                render: (row) => `$${row.total.toFixed(2)}`,
                sortValue: (row) => row.total,
              },
            ]}
            data={quoteRows}
            groupBy={(row) => row.rootQuoteId}
            groupPrimary={quoteGroupPrimary}
            groupMemberLabel={(row) => <Badge className="bg-transparent text-on-surface-muted">v{row.version}</Badge>}
          />
        </ComponentPreview>
      </DocSection>

      <DocSection id="totals" title="Totals row">
        <DocLead>Pass <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">footer</code>, keyed by column, for a report&apos;s totals: a bold row on the sunken band under every page, in the table&apos;s footer.</DocLead>
        <ComponentPreview>
          <Table<InvoiceRow>
            rowKey={(row) => row.number}
            columns={[
              { key: "number", header: "Invoice", render: (row) => row.number },
              { key: "contact", header: "Contact", render: (row) => row.contact },
              { key: "total", header: "Total", align: "right", render: (row) => `$${row.total.toFixed(2)}` },
            ]}
            data={rows}
            footer={{ number: "Total", total: `$${rows.reduce((sum, row) => sum + row.total, 0).toFixed(2)}` }}
          />
        </ComponentPreview>
      </DocSection>

      <DocSection id="printing" title="Printing">
        <DocLead>Prints with its column headings repeated on every page and rows kept whole (the print stylesheet, <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">@spine/ui/print.css</code>). When a page prints from its "Print" action (<code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">printPage()</code>), a paged table shows every row, then goes back to its page after printing.</DocLead>
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
