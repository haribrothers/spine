import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { TableSkeleton } from "./table-skeleton";

const columns = [
  { key: "number", header: "Invoice #" },
  { key: "contact", header: "Contact" },
  { key: "amount", header: "Amount", align: "right" as const },
];

describe("TableSkeleton a11y", () => {
  it("has no violations", async () => {
    const { container } = render(<TableSkeleton columns={columns} rows={4} />);
    await expectNoA11yViolations(container);
  });
});
