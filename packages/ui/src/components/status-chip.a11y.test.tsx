import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { StatusChip } from "./status-chip";

describe("StatusChip a11y", () => {
  it.each(["paid", "due-soon", "overdue", "draft"] as const)("has no violations (%s)", async (status) => {
    const { container } = render(<StatusChip status={status}>{status}</StatusChip>);
    await expectNoA11yViolations(container);
  });
});
