import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { FilterSheet } from "./filter-sheet";

function asPhone(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }));
}
afterEach(() => vi.unstubAllGlobals());

const search = <input aria-label="Search invoices" />;

describe("FilterSheet a11y", () => {
  it("has no violations on a phone with chips", async () => {
    asPhone(true);
    const { container } = render(
      <FilterSheet search={search} chips={[{ key: "s", label: "Overdue", onRemove: () => {} }]} onClearAll={() => {}}>
        <label>
          Status <select />
        </label>
      </FilterSheet>,
    );
    await expectNoA11yViolations(container);
  });

  it("US-OPS-57: from 768px up the controls are inline, as they were", () => {
    asPhone(false);
    render(
      <FilterSheet className="flex gap-2" chips={[]}>
        <button type="button">Status</button>
      </FilterSheet>,
    );
    expect(screen.getByRole("button", { name: "Status" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Filters/ })).toBeNull();
  });

  it("US-OPS-57: on a phone, search and Filters share a row; a chip per filter with ×; the sheet has every filter, Clear all and Show results", () => {
    asPhone(true);
    const onRemove = vi.fn();
    const onClearAll = vi.fn();
    render(
      <FilterSheet search={search} chips={[{ key: "s", label: "Overdue", onRemove }]} onClearAll={onClearAll} showLabel="Show 3 invoices">
        <button type="button">Status</button>
      </FilterSheet>,
    );
    expect(screen.getByRole("textbox", { name: "Search invoices" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Status" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove Overdue" }));
    expect(onRemove).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    const sheet = screen.getByRole("dialog", { name: "Filters" });
    expect(sheet).toBeTruthy();
    expect(screen.getByRole("button", { name: "Status" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Show 3 invoices" })).toBeTruthy();
  });
});
