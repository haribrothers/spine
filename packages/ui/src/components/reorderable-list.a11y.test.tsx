import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { DragHandle, HideToggle, ReorderableItem, ReorderableList } from "./reorderable-list";

const ITEMS = [
  { id: "revenue-trend", label: "Revenue trend" },
  { id: "ar-aging", label: "Receivables aging" },
  { id: "pipeline", label: "Pipeline by stage" },
];

describe("ReorderableList a11y", () => {
  it("has no violations as a plain row list", async () => {
    const { container } = render(
      <ReorderableList itemIds={ITEMS.map((i) => i.id)} onReorder={() => {}} className="flex flex-col gap-1.5">
        {ITEMS.map((item) => (
          <ReorderableItem
            key={item.id}
            id={item.id}
            className="flex items-center gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-[13px]"
          >
            <DragHandle />
            <span className="text-on-surface">{item.label}</span>
          </ReorderableItem>
        ))}
      </ReorderableList>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations with HideToggle controls", async () => {
    const { container } = render(
      <ReorderableList itemIds={ITEMS.map((i) => i.id)} onReorder={() => {}} className="grid grid-cols-2 gap-3">
        {ITEMS.map((item) => (
          <ReorderableItem key={item.id} id={item.id}>
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
              <HideToggle hidden={false} onToggle={() => {}} />
              <DragHandle />
              <span className="text-on-surface">{item.label}</span>
            </div>
          </ReorderableItem>
        ))}
      </ReorderableList>,
    );
    await expectNoA11yViolations(container);
  });
});
