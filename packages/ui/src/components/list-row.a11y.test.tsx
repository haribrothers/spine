import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { ListRow, ListRowSkeleton } from "./list-row";
import { phoneRoles, type TableColumn } from "./table";

describe("ListRow a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <ul>
        <ListRow title={<a href="/invoices/1">INV-0044</a>} badge={<span>Overdue</span>} subtitle="Lakshmi Multispeciality Hospital" trailing="₹3,45,000.00" trailingSub="6 days late" action={<button type="button" aria-label="Actions for INV-0044">⋯</button>} />
        <ListRowSkeleton />
      </ul>,
    );
    await expectNoA11yViolations(container);
  });

  it("US-OPS-56: the title's link covers the row; the action sits above it", () => {
    render(
      <ul>
        <ListRow title={<a href="/invoices/1">INV-0044</a>} action={<button type="button" aria-label="Actions">⋯</button>} />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.className).toContain("[&_[data-list-row-title]_:is(a,button)]:after:inset-0");
    expect(screen.getByRole("button", { name: "Actions" }).parentElement!.className).toContain("z-10");
  });
});

describe("US-OPS-56 · phoneRoles", () => {
  type Row = { id: string };
  const col = (key: string, header: string, align?: "right", phone?: TableColumn<Row>["phone"]): TableColumn<Row> => ({ key, header, render: () => key, align, phone });

  it("places a list's columns without a mapping: title, status badge, subtitle, amount and ⋯; a select column waits for Select mode", () => {
    const roles = phoneRoles([col("select", ""), col("number", "Number"), col("contact", "Contact"), col("status", "Status"), col("issued", "Issued"), col("total", "Total", "right"), col("balance", "Balance due", "right"), col("actions", "")]);
    expect(Object.fromEntries(roles)).toEqual({ select: "select", number: "title", contact: "subtitle", status: "badge", issued: "hidden", total: "hidden", balance: "trailing", actions: "action" });
  });

  it("keeps the roles a list gives and fills the rest", () => {
    const roles = phoneRoles([col("name", "Name"), col("email", "Email", undefined, "subtitle"), col("phone", "Phone"), col("owed", "Owed", "right")]);
    expect(Object.fromEntries(roles)).toEqual({ name: "title", email: "subtitle", phone: "hidden", owed: "trailing" });
  });

  it("the title keeps to one line; badges wrap under it rather than squeezing it", () => {
    const { container } = render(
      <ul>
        <ListRow title={<a href="/quotes/1">DEMO-QUO-0002</a>} badge={<span>Accepted · Viewed 1×</span>} trailing="$9,06,948.00" />
      </ul>,
    );
    const title = container.querySelector("[data-list-row-title]")!;
    expect(title.className).toContain("truncate");
    expect(title.className).toContain("[&_*]:whitespace-nowrap");
    expect(title.parentElement!.className).toContain("flex-wrap");
  });
});
