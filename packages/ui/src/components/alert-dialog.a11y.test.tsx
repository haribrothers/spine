import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { Button } from "./button";

describe("AlertDialog a11y", () => {
  it("has no violations while open", async () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this station?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="danger">Delete</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    // Radix portals AlertDialogContent onto document.body, outside the render container.
    await expectNoA11yViolations(document.body);
  });

  it("the confirm button is primary by default and danger only when asked (US-OPS-10)", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit recurring event</AlertDialogTitle>
            <AlertDialogDescription>Change this event or all events?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>All events</AlertDialogAction>
            <AlertDialogAction variant="danger">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    const primary = screen.getByRole("button", { name: "All events" });
    const danger = screen.getByRole("button", { name: "Delete" });
    expect(primary.getAttribute("data-variant")).toBe("primary");
    expect(primary.className).toContain("bg-primary");
    expect(primary.className).toContain("text-on-primary");
    expect(danger.getAttribute("data-variant")).toBe("danger");
    expect(danger.className).toContain("bg-overdue");
  });
});
