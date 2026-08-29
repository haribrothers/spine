import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Button } from "./button";

describe("Dialog a11y", () => {
  it("has no violations while open", async () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void invoice?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogBody>Voiding creates a reversing entry.</DialogBody>
          <DialogFooter>
            <Button variant="secondary">Cancel</Button>
            <Button variant="danger">Void</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    // Radix portals DialogContent onto document.body, outside the render container.
    await expectNoA11yViolations(document.body);
  });
});
