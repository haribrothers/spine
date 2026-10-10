import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Table, type TableColumn } from "./table";

interface Invoice {
  id: string;
  number: string;
  contact: string;
  amount: number;
}

const invoices: Invoice[] = [
  { id: "1", number: "INV-2026-0041", contact: "Acme Contracting Ltd.", amount: 12500 },
  { id: "2", number: "INV-2026-0042", contact: "Riverbend Fabrication", amount: 8400 },
  { id: "3", number: "INV-2026-0043", contact: "Northgate Builders", amount: 21300 },
];

const columns: TableColumn<Invoice>[] = [
  { key: "number", header: "Invoice #", render: (row) => row.number, sortValue: (row) => row.number },
  { key: "contact", header: "Contact", render: (row) => row.contact },
  { key: "amount", header: "Amount", render: (row) => `$${row.amount.toFixed(2)}`, align: "right", sortValue: (row) => row.amount },
];

describe("Table a11y", () => {
  it("has no violations", async () => {
    const { container } = render(<Table columns={columns} data={invoices} rowKey={(row) => row.id} />);
    await expectNoA11yViolations(container);
  });

  it("has no violations with a totals row", async () => {
    const { container, getByText } = render(<Table columns={columns} data={invoices} rowKey={(row) => row.id} footer={{ number: "Total", amount: "$42,200.00" }} />);
    getByText("$42,200.00");
    await expectNoA11yViolations(container);
  });

  it("has no violations with configurable page size", async () => {
    const { container } = render(
      <Table columns={columns} data={invoices} rowKey={(row) => row.id} configurablePageSize pageSizeOptions={[10, 25]} />,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations grouped with expandable versions", async () => {
    const quoteVersions: Invoice[] = [
      { id: "1", number: "QT-2026-014 v2", contact: "Acme Contracting Ltd.", amount: 12500 },
      { id: "2", number: "QT-2026-014 v1", contact: "Acme Contracting Ltd.", amount: 11800 },
    ];
    const { container } = render(
      <Table
        columns={columns}
        data={quoteVersions}
        rowKey={(row) => row.id}
        groupBy={() => "QT-2026-014"}
        groupPrimary={(rows) => rows[0]!}
      />,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations with a controlled page, which stays put when the data changes (US-CRM-23)", async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: String(i), number: `INV-${i}`, contact: `Contact ${i}`, amount: i }));
    const { container, rerender } = render(<Table columns={columns} data={many} rowKey={(row) => row.id} pageSize={10} page={2} onPageChange={() => {}} />);
    expect(screen.getByText("INV-10")).toBeTruthy();
    rerender(<Table columns={columns} data={[...many]} rowKey={(row) => row.id} pageSize={10} page={2} onPageChange={() => {}} />);
    expect(screen.getByText("INV-10")).toBeTruthy();
    // A page past the end shows the last page.
    rerender(<Table columns={columns} data={many} rowKey={(row) => row.id} pageSize={10} page={9} onPageChange={() => {}} />);
    expect(screen.getByText("INV-20")).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});
