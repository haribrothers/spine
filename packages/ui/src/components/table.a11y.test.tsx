import { fireEvent, render, screen } from "@testing-library/react";
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

  it("has no violations with selectable rows, and the header box selects the page (US-CAT-12)", async () => {
    let selected = new Set<string>(["2"]);
    const onSelectedChange = (next: Set<string>) => {
      selected = next;
    };
    const { container, rerender } = render(
      <Table columns={columns} data={invoices} rowKey={(row) => row.id} selected={selected} onSelectedChange={onSelectedChange} selectLabel={(row) => row.number} />,
    );
    await expectNoA11yViolations(container);
    expect(screen.getByRole("checkbox", { name: "Select every row on this page" }).getAttribute("aria-checked")).toBe("mixed");
    expect(screen.getByRole("checkbox", { name: "Select INV-2026-0042" }).getAttribute("aria-checked")).toBe("true");
    expect(container.querySelectorAll('tr[aria-selected="true"]').length).toBe(1);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select every row on this page" }));
    expect([...selected].sort()).toEqual(["1", "2", "3"]);
    rerender(<Table columns={columns} data={invoices} rowKey={(row) => row.id} selected={selected} onSelectedChange={onSelectedChange} selectLabel={(row) => row.number} />);
    expect(screen.getByRole("checkbox", { name: "Select every row on this page" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select every row on this page" }));
    expect(selected.size).toBe(0);
  });

  it("keeps the sort the parent gives it (US-CAT-13)", () => {
    let sort: { key: string; direction: "asc" | "desc" } | null = { key: "amount", direction: "desc" };
    render(<Table columns={columns} data={invoices} rowKey={(row) => row.id} sort={sort} onSortChange={(next) => (sort = next)} />);
    const firstCells = screen.getAllByRole("row").slice(1).map((r) => r.textContent ?? "");
    expect(firstCells[0]).toContain("INV-2026-0043");
    fireEvent.click(screen.getByRole("button", { name: /Invoice #/ }));
    expect(sort).toEqual({ key: "number", direction: "asc" });
  });

  it("has no violations with rows that open, and the chevron shows what's under a row (US-PAY-27)", async () => {
    const { container } = render(
      <Table
        columns={columns}
        data={invoices}
        rowKey={(row) => row.id}
        renderExpanded={(row) => <p>Lines of {row.number}</p>}
        expandLabel={(row, open) => (open ? `Hide ${row.number}'s lines` : `Show ${row.number}'s lines`)}
      />,
    );
    await expectNoA11yViolations(container);
    const toggle = screen.getByRole("button", { name: "Show INV-2026-0042's lines" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide INV-2026-0042's lines" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Lines of INV-2026-0042")).toBeTruthy();
    expect(screen.queryByText("Lines of INV-2026-0043")).toBeNull();
    await expectNoA11yViolations(container);
  });
});
