import { render } from "@testing-library/react";
import { beforeEach, describe, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { MultiSelect } from "./multi-select";

const contacts = [
  { value: "acme", label: "Acme Contracting Ltd." },
  { value: "brightline", label: "Brightline Interiors" },
  { value: "coastal", label: "Coastal Fabrication Co." },
];

beforeEach(() => {
  // jsdom has no ResizeObserver; MultiSelectValue uses it to remeasure chips.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

describe("MultiSelect a11y", () => {
  it("has no violations closed", async () => {
    const { container } = render(
      <MultiSelect
        options={contacts}
        value={["acme"]}
        onValueChange={() => {}}
        placeholder="Select contacts…"
        aria-label="Contacts"
      />,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations when disabled", async () => {
    const { container } = render(
      <MultiSelect
        options={contacts}
        value={[]}
        onValueChange={() => {}}
        disabled
        placeholder="Select contacts…"
        aria-label="Contacts"
      />,
    );
    await expectNoA11yViolations(container);
  });
});
