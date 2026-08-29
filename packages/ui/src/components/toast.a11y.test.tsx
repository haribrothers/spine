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
