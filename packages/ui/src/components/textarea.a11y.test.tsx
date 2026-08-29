import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Label } from "./label";
import { Textarea } from "./textarea";

describe("Textarea a11y", () => {
  it("has no violations with a label", async () => {
    const { container } = render(
      <div className="flex flex-col gap-1">
        <Label htmlFor="job-notes">Job notes</Label>
        <Textarea id="job-notes" placeholder="Site access details, hazards, etc." />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations disabled", async () => {
    const { container } = render(
      <div className="flex flex-col gap-1">
        <Label htmlFor="job-notes">Job notes</Label>
        <Textarea id="job-notes" disabled value="Access via the loading dock only." readOnly />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations in an error state", async () => {
    const { container } = render(
      <div className="flex flex-col gap-1">
        <Label htmlFor="reject-reason">Rejection reason</Label>
        <Textarea id="reject-reason" error aria-describedby="reject-reason-error" />
        <p id="reject-reason-error">A reason is required to reject this quote.</p>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
