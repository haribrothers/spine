import { render } from "@testing-library/react";
import { describe, it } from "vitest";
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
});
