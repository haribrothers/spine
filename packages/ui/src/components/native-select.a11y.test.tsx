import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Label } from "./label";
import { NativeSelect } from "./native-select";

describe("NativeSelect a11y", () => {
  it("has no violations with an associated label", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="job-status">Status</Label>
        <NativeSelect id="job-status" defaultValue="in_progress">
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In progress</option>
          <option value="complete">Complete</option>
        </NativeSelect>
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations when disabled", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="job-status-disabled">Status</Label>
        <NativeSelect id="job-status-disabled" disabled defaultValue="complete">
          <option value="complete">Complete</option>
        </NativeSelect>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
