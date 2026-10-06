import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Table } from "../components/table";
import { printPage } from "./print-mode";

const rows = Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1), name: `Row ${i + 1}` }));

/** US-RPT-34 — "Print" renders every row of a paged table, then opens the print dialog; afterprint pages again. */
describe("US-RPT-34 · print mode", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows every row while printing", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<Table columns={[{ key: "name", header: "Name", render: (r) => r.name }]} data={rows} rowKey={(r) => r.id} pageSize={10} />);
    expect(screen.getAllByRole("row")).toHaveLength(11);
    act(() => printPage());
    expect(print).toHaveBeenCalled();
    expect(screen.getAllByRole("row")).toHaveLength(26);
    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });
    expect(screen.getAllByRole("row")).toHaveLength(11);
  });
});
