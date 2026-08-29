import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { DataList } from "./data-list";

describe("DataList a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <DataList
        items={[
          { label: "Invoice", value: "INV-2026-0042" },
          { label: "Contact", value: "Acme Contracting Ltd." },
          { label: "Total", value: "$1,240.00" },
          { label: "Status", value: "Paid" },
        ]}
      />,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations with an empty items list", async () => {
    const { container } = render(<DataList items={[]} />);
    await expectNoA11yViolations(container);
  });
});
