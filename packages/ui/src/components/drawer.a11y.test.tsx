import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "./drawer";
import { Button } from "./button";

describe("Drawer a11y", () => {
  it("has no violations while open", async () => {
    render(
      <Drawer open>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Job details</DrawerTitle>
            <DrawerDescription>Kitchen remodel — Coastal Fabrication Co.</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>Milestones, photos, and notes for this job.</DrawerBody>
          <DrawerFooter>
            <Button variant="secondary">Close</Button>
            <Button>Save</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>,
    );
    await expectNoA11yViolations(document.body);
  });

  it.each(["left", "right"] as const)("has no violations (side: %s)", async (side) => {
    render(
      <Drawer open>
        <DrawerContent side={side}>
          <DrawerHeader>
            <DrawerTitle>Filters</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>Filter by status, contact, and date range.</DrawerBody>
        </DrawerContent>
      </Drawer>,
    );
    await expectNoA11yViolations(document.body);
  });
});
