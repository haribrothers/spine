"use client";

import { StatementTable, type StatementRow } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

const columns = [
  { key: "account", header: "Account" },
  { key: "amount", header: "Amount", align: "right" as const },
];

const rows: StatementRow[] = [
  { kind: "section", key: "income", label: "Income" },
  { kind: "line", key: "4100", cells: { account: "4100 · Sales — Services", amount: "$45,265.00" } },
  { kind: "subtotal", key: "total-income", cells: { account: "Total income", amount: "$45,265.00" } },
  { kind: "section", key: "expenses", label: "Expenses" },
  { kind: "line", key: "5300", cells: { account: "5300 · Plant & Equipment Hire", amount: "$150.00" } },
  { kind: "line", key: "6900", cells: { account: "6900 · Other Expenses", amount: "$6,410.00" } },
  { kind: "subtotal", key: "total-expenses", cells: { account: "Total expenses", amount: "$6,560.00" } },
  { kind: "total", key: "net", cells: { account: "Net profit", amount: "$38,705.00" } },
];

export default function StatementTablePage() {
  return (
    <div>
      <DocTitle>StatementTable</DocTitle>
      <DocLead>
        A financial statement as a table — Profit &amp; Loss, Balance Sheet, Cash Flow, Tax Summary, a ledger account&apos;s entries — with the same header, type
        size and spacing as Table, plus section headings, subtotals and a total. Statements aren&apos;t sorted or paged: their order is the meaning. For a list of
        rows to search and sort, use DataTable with a footer.
      </DocLead>

      <ComponentPreview>
        <StatementTable columns={columns} rows={rows} className="w-full" />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "section rows: an uppercase heading spanning the table.",
            "line rows: one per account; cells are any content (a button that opens a drill-down, a link).",
            "subtotal rows in bold; total rows bold on the sunken band, in the table's footer.",
            "empty rows: a muted line such as “Nothing in this period.”",
            "Any number of value columns (comparison columns, each month), right-aligned with tabular figures.",
          ]}
        />
      </DocSection>

      <DocSection id="comparison" title="Comparison columns">
        <ComponentPreview>
          <StatementTable
            className="w-full"
            columns={[
              { key: "account", header: "Account" },
              { key: "now", header: "Jan 1 – Sep 30, 2026", align: "right" },
              { key: "then", header: "Jan 1 – Sep 30, 2025", align: "right" },
              { key: "change", header: "Change", align: "right" },
            ]}
            rows={[
              { kind: "section", key: "income", label: "Income" },
              { kind: "line", key: "4100", cells: { account: "4100 · Sales — Services", now: "$9,000.00", then: "$3,000.00", change: "▲ +$6,000.00" } },
              { kind: "total", key: "net", cells: { account: "Net profit", now: "$9,000.00", then: "$3,000.00", change: "▲ +$6,000.00" } },
            ]}
          />
        </ComponentPreview>
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { StatementTable } from "@spine/ui";

<StatementTable
  columns={[{ key: "account", header: "Account" }, { key: "amount", header: "Amount", align: "right" }]}
  rows={[
    { kind: "section", key: "income", label: "Income" },
    { kind: "line", key: "4100", cells: { account: "4100 · Sales", amount: "$45,265.00" } },
    { kind: "subtotal", key: "total-income", cells: { account: "Total income", amount: "$45,265.00" } },
    { kind: "total", key: "net", cells: { account: "Net profit", amount: "$38,705.00" } },
  ]}
/>`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "columns", type: "StatementColumn[]", description: "{ key, header, align? } — the first is usually the label." },
            { prop: "rows", type: "StatementRow[]", description: "section | line | subtotal | total | empty." },
            { prop: "data-testid", type: "string", description: "Set on the <table>." },
          ]}
        />
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          A native table: column headers are <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{"<th scope=\"col\">"}</code>,
          section headings are row-group headers, and totals sit in <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{"<tfoot>"}</code>.
          Signs and arrows carry direction, never colour alone. Prints with its headings repeated on every page.
        </DocLead>
      </DocSection>
    </div>
  );
}
