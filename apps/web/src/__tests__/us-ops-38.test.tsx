import { useRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastHost, useToast } from "../components/toast-host";
import { ActionError } from "../components/action-error";
import { paymentRecordedToast } from "../components/record-payment-dialog";
import { QUOTE_TOASTS } from "../app/(app)/quotes/quote-row-actions";
import { creditNoteIssuedToast } from "../app/(app)/invoices/create-credit-note-dialog";
import type { Quote } from "../app/(app)/quotes/types";
import type { CreditNote } from "../app/(app)/invoices/types";

/** A page that shows a numbered toast each time its button is pressed. */
function Shower() {
  const toast = useToast();
  const n = useRef(0);
  return (
    <button type="button" onClick={() => toast(`Toast ${++n.current}`, `Line ${n.current}`)}>
      Show
    </button>
  );
}

/** Titles of the toasts on screen, oldest first in the page (the viewport shows them reversed). */
function titles() {
  return screen.queryAllByTestId("toast").map((t) => t.textContent ?? "");
}

function phoneWidth(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches, addEventListener: () => {}, removeEventListener: () => {} })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("US-OPS-38 · know an action worked, wherever it takes me", () => {
  it("stacks up to the host's maximum and a new one over it closes the oldest at once", async () => {
    phoneWidth(false);
    render(
      <ToastHost max={3} duration={60_000}>
        <Shower />
      </ToastHost>,
    );
    const button = screen.getByRole("button", { name: "Show" });
    for (let i = 0; i < 4; i++) fireEvent.click(button);
    await waitFor(() => expect(screen.getAllByTestId("toast")).toHaveLength(3));
    expect(titles()).toEqual(["Toast 2Line 2", "Toast 3Line 3", "Toast 4Line 4"]);
  });

  it("the maximum is set on the component", async () => {
    phoneWidth(false);
    render(
      <ToastHost max={5} duration={60_000}>
        <Shower />
      </ToastHost>,
    );
    const button = screen.getByRole("button", { name: "Show" });
    for (let i = 0; i < 6; i++) fireEvent.click(button);
    await waitFor(() => expect(screen.getAllByTestId("toast")).toHaveLength(5));
  });

  it("holds two at phone width, whatever the maximum", async () => {
    phoneWidth(true);
    render(
      <ToastHost max={3} duration={60_000}>
        <Shower />
      </ToastHost>,
    );
    const button = screen.getByRole("button", { name: "Show" });
    for (let i = 0; i < 3; i++) fireEvent.click(button);
    await waitFor(() => expect(screen.getAllByTestId("toast")).toHaveLength(2));
    expect(titles()).toEqual(["Toast 2Line 2", "Toast 3Line 3"]);
  });

  it("a toast closed just before the host goes leaves no removal waiting to run", async () => {
    phoneWidth(false);
    const clear = vi.spyOn(window, "clearTimeout");
    const { unmount } = render(
      <ToastHost max={3} duration={60_000}>
        <Shower />
      </ToastHost>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    await waitFor(() => expect(screen.getAllByTestId("toast")).toHaveLength(1));
    const set = vi.spyOn(window, "setTimeout");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    const removal = set.mock.results.find((r, i) => set.mock.calls[i]?.[1] === 200)?.value;
    expect(removal).toBeDefined();
    unmount();
    expect(clear).toHaveBeenCalledWith(removal);
    set.mockRestore();
    clear.mockRestore();
  });

  it("each closes after its own interval, and its × closes it", async () => {
    phoneWidth(false);
    render(
      <ToastHost max={3} duration={150}>
        <Shower />
      </ToastHost>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(await screen.findByText("Toast 1")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Toast 1")).toBeNull(), { timeout: 2000 });

    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(await screen.findByText("Toast 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(screen.queryByText("Toast 2")).toBeNull());
  });

  it("does nothing outside a host (one screen rendered alone)", () => {
    render(<Shower />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Show" }))).not.toThrow();
    expect(screen.queryAllByTestId("toast")).toHaveLength(0);
  });

  it("says what happened and what's next for the actions that open another page", () => {
    const quote = { number: "QUO-0034", version: 2 } as Quote;
    expect(QUOTE_TOASTS.revised(quote)).toEqual(["QUO-0034 revised", "Version 3 is a draft — edit it, then send it to replace version 2."]);
    expect(QUOTE_TOASTS.toJob(quote, "JOB-0007")[1]).toBe("JOB-0007 is open — set up its milestones next.");
    expect(
      paymentRecordedToast({ id: "p", number: "RCP-0032", contactName: "Lakshmi Multispeciality Hospital", currency: "INR", unallocatedAmount: "3800000", appliedTo: [] })[0],
    ).toBe("RCP-0032 recorded");
    expect(paymentRecordedToast({ id: "p", number: "RCP-0033", contactName: "Halcyon", currency: "INR", unallocatedAmount: "0", appliedTo: [{ invoiceId: "i", number: "INV-0039" }] })[1]).toBe(
      "It paid INV-0039.",
    );
    expect(creditNoteIssuedToast({ number: "CN-0004", currency: "INR", creditRemainingAmount: "0" } as CreditNote, "Halcyon")).toEqual([
      "CN-0004 issued",
      "The invoice's balance has been updated.",
    ]);
  });

  it("a failed action's error shows where the action was, with a × to close it", () => {
    const onDismiss = vi.fn();
    render(<ActionError title="Couldn't delete the payment." message="Try again." onDismiss={onDismiss} />);
    expect(screen.getByRole("alert").textContent).toBe("Couldn't delete the payment. Try again.");
    fireEvent.click(screen.getByRole("button", { name: "Close this message" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
