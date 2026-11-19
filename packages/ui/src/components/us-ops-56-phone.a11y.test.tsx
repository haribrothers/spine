import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "./data-table";
import { Table, type TableColumn } from "./table";

type Row = { id: string; number: string; status: string; amount: string };
const ROWS: Row[] = Array.from({ length: 30 }, (_, i) => ({ id: String(i), number: `INV-${String(i + 1).padStart(4, "0")}`, status: "Due", amount: `$${i + 1}.00` }));
const COLUMNS: TableColumn<Row>[] = [
  { key: "number", header: "Number", render: (r) => <a href={`/invoices/${r.id}`}>{r.number}</a> },
  { key: "status", header: "Status", render: (r) => r.status },
  { key: "amount", header: "Amount", align: "right", render: (r) => r.amount },
];

/** Makes `usePhone` answer as a 390px-wide phone. */
function phoneMedia(query: string) {
  return { matches: true, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", phoneMedia);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("US-OPS-56 · read any list as rows made for my phone", () => {
  it("shows rows, not a table, with Load more and '25 of 30' past the first 25", () => {
    render(<Table columns={COLUMNS} data={ROWS} rowKey={(r) => r.id} configurablePageSize />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(25);
    expect(screen.getByText("25 of 30")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(30);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    // No page-size picker on a phone.
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows checkboxes only in Select mode", () => {
    const { rerender } = render(<Table columns={COLUMNS} data={ROWS.slice(0, 3)} rowKey={(r) => r.id} selected={new Set()} onSelectedChange={() => {}} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    rerender(<Table columns={COLUMNS} data={ROWS.slice(0, 3)} rowKey={(r) => r.id} selected={new Set()} onSelectedChange={() => {}} phoneSelecting />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("stays a table for a grid that asks to", () => {
    render(<Table columns={COLUMNS} data={ROWS.slice(0, 3)} rowKey={(r) => r.id} phoneRows={false} />);
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("DataTable hides Columns on a phone", () => {
    render(<DataTable columns={COLUMNS} data={ROWS.slice(0, 3)} rowKey={(r) => r.id} />);
    expect(screen.getByRole("button", { name: "Columns" }).className).toContain("hidden");
  });
});
