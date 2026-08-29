import { render } from "@testing-library/react";
import { describe, it } from "vitest";
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
});
