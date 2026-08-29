import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Label } from "./label";
import { Switch } from "./switch";

describe("Switch a11y", () => {
  it("has no violations unchecked with a label", async () => {
    const { container } = render(
      <div className="flex items-center gap-2">
        <Switch id="notify-overdue" />
        <Label htmlFor="notify-overdue">Notify on overdue invoices</Label>
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations checked", async () => {
    const { container } = render(
      <div className="flex items-center gap-2">
        <Switch id="notify-overdue" checked onCheckedChange={() => {}} />
        <Label htmlFor="notify-overdue">Notify on overdue invoices</Label>
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations disabled", async () => {
    const { container } = render(
      <div className="flex items-center gap-2">
        <Switch id="notify-overdue" disabled />
        <Label htmlFor="notify-overdue">Notify on overdue invoices</Label>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
