import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { ActionSheet } from "./action-sheet";

describe("ActionSheet a11y", () => {
  it("has no violations", async () => {
    render(
      <ActionSheet
        open
        onOpenChange={() => {}}
        title="INV-0044"
        subtitle="Lakshmi Multispeciality Hospital"
        actions={[
          { key: "view", label: "View", onSelect: () => {} },
          { key: "void", label: "Void…", onSelect: () => {}, destructive: true },
        ]}
      />,
    );
    await expectNoA11yViolations(document.body);
  });

  it("US-OPS-60: closes, then runs the chosen action; Cancel only closes", async () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    const onVoid = vi.fn();
    render(<ActionSheet open onOpenChange={onOpenChange} title="INV-0044" actions={[{ key: "void", label: "Void…", onSelect: onVoid, destructive: true }]} />);
    expect(screen.getByRole("dialog", { name: "INV-0044" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Void…" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onVoid).not.toHaveBeenCalled();
    await act(async () => vi.runAllTimers());
    expect(onVoid).toHaveBeenCalledOnce();
    vi.useRealTimers();
    onOpenChange.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
