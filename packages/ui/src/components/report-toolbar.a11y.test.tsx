import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Button } from "./button";
import { Input } from "./input";
import { ReportFilter, ReportFilterCheckbox, ReportToolbar } from "./report-toolbar";

function Example({ loading = false }: { loading?: boolean }) {
  return (
    <ReportToolbar
      loading={loading}
      filters={
        <>
          <ReportFilter label="From">{(id) => <Input aria-labelledby={id} defaultValue="2026-07-01" />}</ReportFilter>
          <ReportFilter label="To">{(id) => <Input aria-labelledby={id} defaultValue="2026-09-30" />}</ReportFilter>
          <ReportFilterCheckbox label="Hide accounts with no balance" checked onCheckedChange={() => {}} />
        </>
      }
      actions={
        <>
          <Button variant="secondary">Export</Button>
          <Button>Record tax payment</Button>
        </>
      }
    />
  );
}

describe("ReportToolbar a11y", () => {
  it("has no violations", async () => {
    const { container, getByRole } = render(<Example />);
    expect(getByRole("textbox", { name: "From" })).toBeTruthy();
    expect(getByRole("checkbox", { name: "Hide accounts with no balance" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("has no violations while loading, and says it's updating", async () => {
    const { container, getByRole } = render(<Example loading />);
    expect(getByRole("status", { name: "Updating the report" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});
