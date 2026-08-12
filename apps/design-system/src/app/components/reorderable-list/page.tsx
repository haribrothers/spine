"use client";

import { useState } from "react";
import { ReorderableItem, ReorderableList } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

const INITIAL_ITEMS = [
  { id: "kpi-summary", label: "KPI summary" },
  { id: "revenue-trend", label: "Revenue trend" },
  { id: "ar-aging", label: "Receivables aging" },
  { id: "pipeline-by-stage", label: "Pipeline by stage" },
];

function ReorderableListDemo() {
  const [order, setOrder] = useState(INITIAL_ITEMS.map((i) => i.id));
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const byId = new Map(INITIAL_ITEMS.map((i) => [i.id, i]));

  return (
    <ReorderableList itemIds={order} onReorder={setOrder} className="w-full max-w-sm">
      {order.map((id) => (
        <ReorderableItem
          key={id}
          id={id}
          hidden={hiddenIds.has(id)}
          onToggleHidden={() =>
            setHiddenIds((prev) => {
              const next = new Set(prev);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            })
          }
        >
          {byId.get(id)?.label}
        </ReorderableItem>
      ))}
    </ReorderableList>
  );
}

export default function ReorderableListPage() {
  return (
    <div>
      <DocTitle>ReorderableList</DocTitle>
      <DocLead>
        A single flat drag-to-reorder list — native HTML5 drag-and-drop, the same idiom{" "}
        <code>KanbanBoard</code>/<code>KanbanCard</code> already use (draggable + drag-state-in-context), adapted
        for one container instead of many drop-target columns. No new dependency — a single-list reorder only needs
        &quot;compare pointer position against sibling midpoints,&quot; which this codebase&apos;s existing Kanban
        pattern already solves for the harder multi-column case.
      </DocLead>

      <ComponentPreview>
        <ReorderableListDemo />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Drag any row to reorder — drop position is computed from pointer Y vs. the target row's own vertical midpoint.",
            "Optional per-row hide/show toggle (onToggleHidden) — a plain click handler, unrelated to drag.",
            "onReorder only fires when the order actually changed, never for a drag that ends where it started.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { ReorderableList, ReorderableItem } from "@spine/ui";

const [order, setOrder] = useState(["a", "b", "c"]);

<ReorderableList itemIds={order} onReorder={setOrder}>
  {order.map((id) => (
    <ReorderableItem key={id} id={id}>
      {id}
    </ReorderableItem>
  ))}
</ReorderableList>`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "ReorderableList.itemIds", type: "string[]", description: "Ordered ids, matching each item's own id." },
            { prop: "ReorderableList.onReorder", type: "(newOrder: string[]) => void", description: "Fires once a completed drag actually changes the order." },
            { prop: "ReorderableItem.id", type: "string" },
            { prop: "ReorderableItem.hidden", type: "boolean", description: "Dims the row. Default false." },
            { prop: "ReorderableItem.onToggleHidden", type: "() => void", description: "Renders an eye/eye-off toggle button when provided." },
          ]}
        />
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Native HTML5 drag-and-drop has no built-in keyboard equivalent — a future pass could add up/down reorder
          buttons alongside the drag handle for keyboard-only users, matching the same gap already flagged on{" "}
          <code>Calendar</code>&apos;s own pointer-only resize handles.
        </DocLead>
      </DocSection>
    </div>
  );
}
