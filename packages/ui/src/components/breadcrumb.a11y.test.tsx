import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Breadcrumb } from "./breadcrumb";

describe("Breadcrumb a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <Breadcrumb
        items={[
          { label: "Jobs", href: "/jobs" },
          { label: "Riverside Extension", href: "/jobs/riverside" },
          { label: "Milestones" },
        ]}
      />,
    );
    await expectNoA11yViolations(container);
  });

  it("US-OPS-61: stays on one line, the middle item shortening with its full label as a tooltip", async () => {
    const { container, getByRole } = render(
      <Breadcrumb items={[{ label: "Billing" }, { label: "Invoices", href: "/invoices" }, { label: "A very long draft invoice for Sunstone Retail Fitouts" }]} />,
    );
    const nav = getByRole("navigation", { name: "Breadcrumb" });
    expect(nav.className).toContain("flex-nowrap");
    const middle = getByRole("link", { name: "Invoices" });
    expect(middle.getAttribute("title")).toBe("Invoices");
    expect(middle.className).toContain("inline-flex");
    expect(middle.querySelector("span")?.className).toContain("truncate");
    expect(container.querySelector('[aria-current="page"]')?.className).toContain("truncate");
    await expectNoA11yViolations(container);
  });
});
