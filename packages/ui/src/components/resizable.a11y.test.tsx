import { render } from "@testing-library/react";
import { beforeEach, describe, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable";

beforeEach(() => {
  // jsdom has no ResizeObserver; react-resizable-panels uses it to measure the group.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

describe("Resizable a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <ResizablePanelGroup className="h-48 rounded-md border border-border">
        <ResizablePanel defaultSize={30}>
          <div className="p-3 text-[13px] text-on-surface">Job list</div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={70}>
          <div className="p-3 text-[13px] text-on-surface">Job detail</div>
        </ResizablePanel>
      </ResizablePanelGroup>,
    );
    await expectNoA11yViolations(container);
  });
});
