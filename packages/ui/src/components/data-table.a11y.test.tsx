import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { DataTable } from "./data-table";
import { StatusChip } from "./status-chip";

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
];

describe("DataTable a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <DataTable<InvoiceRow>
        rowKey={(row) => row.number}
        searchKey={(row) => row.contact}
        searchPlaceholder="Search by contact…"
        columns={[
          { key: "number", header: "Invoice", render: (row) => row.number },
          { key: "contact", header: "Contact", render: (row) => row.contact },
          { key: "total", header: "Total", align: "right", render: (row) => `$${row.total.toFixed(2)}` },
          { key: "status", header: "Status", render: (row) => <StatusChip status={row.status}>{row.status}</StatusChip> },
        ]}
        data={rows}
      />,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations with no search key", async () => {
    const { container } = render(
      <DataTable<InvoiceRow>
        rowKey={(row) => row.number}
        columns={[
          { key: "number", header: "Invoice", render: (row) => row.number },
          { key: "contact", header: "Contact", render: (row) => row.contact },
        ]}
        data={rows}
      />,
    );
    await expectNoA11yViolations(container);
  });

  it("labels the search box and reports what was typed", () => {
    const onSearchChange = vi.fn();
    render(
      <DataTable<InvoiceRow>
        rowKey={(row) => row.number}
        searchKey={(row) => row.contact}
        searchPlaceholder="Search by contact…"
        onSearchChange={onSearchChange}
        columns={[{ key: "contact", header: "Contact", render: (row) => row.contact }]}
        data={rows}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Search by contact…" }), { target: { value: "acme" } });
    expect(onSearchChange).toHaveBeenCalledWith("acme");
  });
});
