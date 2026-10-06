import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { StatementTable, type StatementRow } from "./statement-table";

const columns = [
  { key: "account", header: "Account" },
  { key: "amount", header: "Amount", align: "right" as const },
];

const rows: StatementRow[] = [
  { kind: "section", key: "income", label: "Income" },
  { kind: "line", key: "4100", cells: { account: "4100 · Sales — Services", amount: "$45,265.00" } },
  { kind: "subtotal", key: "total-income", cells: { account: "Total income", amount: "$45,265.00" } },
  { kind: "section", key: "expenses", label: "Expenses" },
  { kind: "empty", key: "no-expenses", label: "No expenses posted in this range." },
  { kind: "subtotal", key: "total-expenses", cells: { account: "Total expenses", amount: "$0.00" } },
  { kind: "total", key: "net", cells: { account: "Net profit", amount: "$45,265.00" }, testId: "net" },
];

describe("StatementTable a11y", () => {
  it("has no violations", async () => {
    const { container, getByRole, getByTestId } = render(<StatementTable columns={columns} rows={rows} />);
    expect(getByRole("rowheader", { name: "Income" })).toBeTruthy();
    expect(getByTestId("net").textContent).toContain("Net profit");
    await expectNoA11yViolations(container);
  });

  it("has no violations with several value columns", async () => {
    const wide = [...columns, { key: "previous", header: "Jan 1 – Mar 31, 2026", align: "right" as const }, { key: "change", header: "Change", align: "right" as const }];
    const { container } = render(
      <StatementTable columns={wide} rows={[{ kind: "line", key: "a", cells: { account: "4100 · Sales", amount: "$10.00", previous: "$8.00", change: "▲ +$2.00" } }]} />,
    );
    await expectNoA11yViolations(container);
  });
});
