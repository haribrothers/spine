import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./toast";

describe("Toast a11y", () => {
  it("has no violations while open", async () => {
    render(
      <ToastProvider>
        <Toast open>
          <div>
            <ToastTitle>Invoice sent</ToastTitle>
            <ToastDescription>INV-2026-0042 was emailed to Acme Contracting Ltd.</ToastDescription>
          </div>
          <ToastClose />
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );
    // Radix portals the viewport/toast onto document.body.
    await expectNoA11yViolations(document.body);
  });
});

describe("Toast Escape", () => {
  it("doesn't swallow Escape meant for an open dialog", async () => {
    const { Dialog, DialogContent, DialogTitle, DialogDescription } = await import("./dialog");
    const { act, fireEvent, waitFor, screen } = await import("@testing-library/react");
    const { useState } = await import("react");
    const { expect } = await import("vitest");
    function Harness() {
      const [dialogOpen, setDialogOpen] = useState(true);
      const [toastOpen, setToastOpen] = useState(true);
      return (
        <ToastProvider>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogTitle>Expense</DialogTitle>
              <DialogDescription>Fuel and tolls</DialogDescription>
            </DialogContent>
          </Dialog>
          <Toast open={toastOpen} onOpenChange={setToastOpen}>
            <ToastTitle>Expense updated</ToastTitle>
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );
    }
    render(<Harness />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    });
    await waitFor(() => expect(screen.queryByText("Expense updated")).toBeNull());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
