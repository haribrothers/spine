import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { ReportFilter, ReportToolbar } from "./report-toolbar";
import { StatementTable, type StatementColumn, type StatementRow } from "./statement-table";
import { Table } from "./table";

function asPhone(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }));
}
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

const rows: StatementRow[] = [
  { kind: "section", key: "s", label: "Income" },
  { kind: "line", key: "a", cells: { account: <a href="/ledger/4100">Sales — construction</a>, amount: "$118,200.00", prior: "$90,000.00" } },
  { kind: "line", key: "b", cells: { account: "Sales — services", amount: "$6,400.00", prior: "$5,000.00" } },
  { kind: "subtotal", key: "st", cells: { account: "Total income", amount: "$124,600.00", prior: "$95,000.00" } },
  { kind: "total", key: "t", cells: { account: "Net profit", amount: "$28,476.00", prior: "$20,000.00" } },
];

describe("US-RPT-41 · read reports on my phone", () => {
  it("the filters are one line saying what's chosen, which opens a Report filters sheet with every filter", async () => {
    asPhone(true);
    const { baseElement } = render(
      <ReportToolbar
        summary="Jan 1 – Nov 18, 2026 · Accrual · No comparison"
        filters={
          <ReportFilter label="Basis">
            <select aria-label="Basis">
              <option>Accrual</option>
            </select>
          </ReportFilter>
        }
      />,
    );
    const line = screen.getByTestId("report-filter-summary");
    expect(line.textContent).toContain("Jan 1 – Nov 18, 2026 · Accrual · No comparison");
    expect(screen.queryByRole("combobox", { name: "Basis" })).toBeNull();
    fireEvent.click(line);
    const sheet = screen.getByRole("dialog", { name: "Report filters" });
    expect(sheet.querySelector("select")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show report" })).toBeTruthy();
    await expectNoA11yViolations(baseElement);
  });

  it("from 768px up the filters are inline, as they were", () => {
    asPhone(false);
    render(<ReportToolbar summary="Jan 1 – Nov 18" filters={<ReportFilter label="Basis">{<select aria-label="Basis" />}</ReportFilter>} />);
    expect(screen.queryByTestId("report-filter-summary")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Basis" })).toBeTruthy();
  });

  it("a statement is an indented list: headings, accounts with amounts, the other period muted under it, bold subtotals, the total last; a drill-down row has a chevron", async () => {
    asPhone(true);
    const columns: StatementColumn[] = [
      { key: "account", header: "Account" },
      { key: "amount", header: "This year", align: "right" },
      { key: "prior", header: "Last year", align: "right" },
    ];
    const { container } = render(<StatementTable columns={columns} rows={rows} data-testid="pl" />);
    const list = screen.getByTestId("pl");
    expect(list.tagName).toBe("UL");
    expect(container.querySelector("table")).toBeNull();
    const items = Array.from(list.querySelectorAll("li"));
    expect(items[0]!.textContent).toBe("Income");
    expect(items[1]!.className).toContain("pl-8");
    expect(items[1]!.textContent).toContain("$118,200.00");
    expect(items[1]!.textContent).toContain("Last year: $90,000.00");
    expect(items[3]!.className).toContain("font-semibold");
    expect(items[items.length - 1]!.textContent).toContain("Net profit");
    // The drill-down's link covers the row, and the row shows a chevron (CSS: group-has-[a]).
    expect(items[1]!.className).toContain("[&_:is(a,button)]:after:inset-0");
    await expectNoA11yViolations(container);
  });

  it("three or more periods stay a table whose first column stays put", () => {
    asPhone(true);
    const columns: StatementColumn[] = [
      { key: "account", header: "Account" },
      { key: "amount", header: "2026", align: "right" },
      { key: "prior", header: "2025", align: "right" },
      { key: "older", header: "2024", align: "right" },
    ];
    render(<StatementTable columns={columns} rows={rows} data-testid="cmp" />);
    const table = screen.getByTestId("cmp");
    expect(table.tagName).toBe("TABLE");
    expect(table.querySelector("th")!.className).toContain("sticky");
  });

  it("a grid table keeps its first column in place on a phone", () => {
    asPhone(true);
    render(
      <Table
        data={[{ id: "1", account: "1010 HDFC Current", debit: "$92,475.00", credit: "—" }]}
        rowKey={(r) => r.id}
        phoneRows={false}
        stickyFirstColumn
        columns={[
          { key: "account", header: "Account", render: (r) => r.account },
          { key: "debit", header: "Debit", align: "right", render: (r) => r.debit },
          { key: "credit", header: "Credit", align: "right", render: (r) => r.credit },
        ]}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Account" }).className).toContain("sticky");
    expect(screen.getByRole("cell", { name: "1010 HDFC Current" }).className).toContain("left-0");
    expect(screen.getByRole("cell", { name: "$92,475.00" }).className).not.toContain("sticky");
  });
});
