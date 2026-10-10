import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { KanbanBoard, KanbanCard, KanbanColumn } from "./kanban";

describe("Kanban a11y", () => {
  it("has no violations with columns and cards", async () => {
    const { container } = render(
      <div style={{ height: 420 }}>
        <KanbanBoard>
          <KanbanColumn title="New" meta={2} subtitle="$60,500">
            <KanbanCard id="1">Warehouse fit-out</KanbanCard>
            <KanbanCard id="2">Office refurbishment</KanbanCard>
          </KanbanColumn>
          <KanbanColumn title="Qualified" meta={1}>
            <KanbanCard id="3">Steel frame supply</KanbanCard>
          </KanbanColumn>
          <KanbanColumn title="Won" meta={0} />
        </KanbanBoard>
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  // US-CRM-24/25 (D-211): a slim column is one button; an openable card is a button with its menu beside it, never inside it.
  it("has no violations with a slim column and openable cards with a menu", async () => {
    const { container } = render(
      <div style={{ height: 420 }}>
        <KanbanBoard>
          <KanbanColumn title="Proposal" meta={1} accent={<span aria-hidden>●</span>}>
            <KanbanCard id="1" label="Ground-floor extension, Ananya Rao" onOpen={() => {}} menu={<button type="button" aria-label="Actions for Ground-floor extension">⋯</button>}>
              Ground-floor extension
            </KanbanCard>
          </KanbanColumn>
          <KanbanColumn title="Won" meta={3} subtitle="$12,000 · 30 days" collapsed expandLabel="Show Won: 3 leads in the last 30 days" onExpand={() => {}} />
        </KanbanBoard>
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("opens a card with Enter or Space, its menu with the menu key, and a slim column on press", () => {
    const onOpen = vi.fn();
    const onMenuKey = vi.fn();
    const onExpand = vi.fn();
    render(
      <KanbanBoard>
        <KanbanColumn title="New">
          <KanbanCard id="1" label="Villa extension" onOpen={onOpen} onMenuKey={onMenuKey}>
            Villa extension
          </KanbanCard>
        </KanbanColumn>
        <KanbanColumn title="Lost" collapsed expandLabel="Show Lost" onExpand={onExpand} />
      </KanbanBoard>,
    );
    const card = screen.getByRole("button", { name: "Villa extension" });
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    fireEvent.keyDown(card, { key: "F10", shiftKey: true });
    fireEvent.keyDown(card, { key: "ContextMenu" });
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onMenuKey).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Show Lost" }));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });
});
