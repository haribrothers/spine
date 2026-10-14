import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Combobox } from "./combobox";

const options = [
  { value: "acme", label: "Acme Contracting Ltd." },
  { value: "brightline", label: "Brightline Interiors" },
  { value: "coastal", label: "Coastal Fabrication Co." },
];

beforeEach(() => {
  // jsdom has no ResizeObserver; cmdk (used by Combobox's popover list) uses it internally.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  // jsdom doesn't implement scrollIntoView; cmdk calls it when the selected item changes.
  Element.prototype.scrollIntoView = vi.fn();
});

describe("Combobox a11y", () => {
  it("has no violations closed", async () => {
    const { container } = render(
      <Combobox options={options} onValueChange={() => {}} placeholder="Select contact…" aria-label="Contact" />,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations open", async () => {
    render(<Combobox options={options} onValueChange={() => {}} placeholder="Select contact…" aria-label="Contact" />);
    const user = userEvent.setup();
    await user.click(document.querySelector('[role="combobox"]')!);
    await expectNoA11yViolations(document.body);
  });

  it("has no violations with a value selected", async () => {
    const { container } = render(<Combobox options={options} value="acme" onValueChange={() => {}} aria-label="Contact" />);
    await expectNoA11yViolations(container);
  });

  it("has no violations open with a second line per option", async () => {
    const described = [
      { value: "fuel", label: "Fuel & freight", description: "Diesel, petrol, tolls and getting materials to site" },
      { value: "materials", label: "Materials", description: "Cement, steel, sand — anything that goes into the build" },
    ];
    render(<Combobox options={described} onValueChange={() => {}} placeholder="Select a category…" aria-label="Category" />);
    const user = userEvent.setup();
    await user.click(document.querySelector('[role="combobox"]')!);
    await expectNoA11yViolations(document.body);
  });

  it("has no violations when disabled", async () => {
    const { container } = render(<Combobox options={options} onValueChange={() => {}} disabled aria-label="Contact" />);
    await expectNoA11yViolations(container);
  });
});
