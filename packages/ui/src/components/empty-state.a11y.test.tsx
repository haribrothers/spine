import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { EmptyState } from "./empty-state";
import { Button } from "./button";
import { Inbox } from "lucide-react";

describe("EmptyState a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <EmptyState
        icon={<Inbox />}
        title="No invoices yet"
        description="Invoices you issue will show up here."
        action={<Button>New invoice</Button>}
      />,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations with no icon, description, or action", async () => {
    const { container } = render(<EmptyState title="No jobs found" />);
    await expectNoA11yViolations(container);
  });
});
