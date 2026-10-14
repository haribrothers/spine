import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { useConfirm } from "./use-confirm";

function Harness({ danger }: { danger?: boolean }) {
  const { confirm, dialog } = useConfirm();
  return (
    <>
      <button type="button" onClick={() => void confirm({ title: danger ? "Delete this refund?" : "Record this bill?", description: "It changes your books.", confirmLabel: danger ? "Delete refund" : "Record bill", danger })}>
        Open
      </button>
      {dialog}
    </>
  );
}

describe("useConfirm a11y", () => {
  it("has no violations while asking, with a primary or a danger verb", async () => {
    for (const danger of [false, true]) {
      const { container, unmount } = render(<Harness danger={danger} />);
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
      await screen.findByRole("alertdialog");
      await expectNoA11yViolations(container.ownerDocument.body);
      unmount();
    }
  });
});

function Answering({ onResult }: { onResult: (ok: boolean) => void }) {
  const { confirm, dialog } = useConfirm();
  return (
    <>
      <button type="button" onClick={async () => onResult(await confirm({ title: "Record this bill?", description: "It's posted to your books.", confirmLabel: "Record bill" }))}>
        Record
      </button>
      {dialog}
    </>
  );
}

describe("D-218 · useConfirm — a major action asks first", () => {
  it("does nothing until the person answers, then resolves with what they chose", async () => {
    const results: boolean[] = [];
    render(<Answering onResult={(ok) => results.push(ok)} />);

    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Record this bill?" });
    expect(dialog.textContent).toContain("It's posted to your books.");
    expect(results).toEqual([]);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Record bill" })));
    expect(results).toEqual([true]);
    expect(screen.queryByRole("alertdialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    await screen.findByRole("alertdialog");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Go back" })));
    expect(results).toEqual([true, false]);
  });
});
