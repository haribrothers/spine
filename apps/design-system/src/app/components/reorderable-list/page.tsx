"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, DragHandle, HideToggle, ReorderableItem, ReorderableList, useReorderableItemDragState } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

const CARD_ITEMS = [
  { id: "revenue-trend", label: "Revenue trend", body: "Bar chart, 12 months" },
  { id: "ar-aging", label: "Receivables aging", body: "Donut, 5 buckets" },
  { id: "pipeline", label: "Pipeline by stage", body: "Bar chart, 5 stages" },
  { id: "activity", label: "Recent activity", body: "List, last 6 events" },
];

function CardGridDemo() {
  const [order, setOrder] = useState(CARD_ITEMS.map((i) => i.id));
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const byId = new Map(CARD_ITEMS.map((i) => [i.id, i]));

  return (
    <ReorderableList itemIds={order} onReorder={setOrder} className="grid w-full grid-cols-2 gap-3">
      {order.map((id) => {
        const item = byId.get(id)!;
        const hidden = hiddenIds.has(id);
        return (
          <CardGridItem
            key={id}
            id={id}
            hidden={hidden}
            onToggleHidden={() =>
              setHiddenIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) {
                  next.delete(id);
                } else {
                  next.add(id);
                }
                return next;
              })
            }
          >
            <Card>
              <CardHeader>
                <CardTitle>{item.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-[13px] text-on-surface-muted">{item.body}</CardContent>
            </Card>
          </CardGridItem>
        );
      })}
    </ReorderableList>
  );
}

function CardGridItem({ id, hidden, onToggleHidden, children }: { id: string; hidden: boolean; onToggleHidden: () => void; children: React.ReactNode }) {
  const { isOver } = useReorderableItemDragState(id);
  return (
    <ReorderableItem id={id}>
      <div className={`relative rounded-lg ${isOver ? "ring-2 ring-primary ring-offset-2" : ""}`}>
        <div className={hidden ? "opacity-40" : ""}>{children}</div>
        <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md border border-border bg-surface px-1.5 py-1 shadow-sm">
          <HideToggle hidden={hidden} onToggle={onToggleHidden} />
          <DragHandle />
        </div>
      </div>
    </ReorderableItem>
  );
}

function RowListDemo() {
  const [order, setOrder] = useState(CARD_ITEMS.map((i) => i.id));
  const byId = new Map(CARD_ITEMS.map((i) => [i.id, i]));

  return (
    <ReorderableList itemIds={order} onReorder={setOrder} className="flex w-full max-w-sm flex-col gap-1.5">
      {order.map((id) => (
        <ReorderableItem key={id} id={id} className="flex items-center gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-[13px]">
          <DragHandle />
          <span className="text-on-surface">{byId.get(id)?.label}</span>
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
        Drag-to-reorder state and wiring — native HTML5 drag-and-drop, the same idiom <code>KanbanBoard</code>/
        <code>KanbanCard</code> already use (draggable + drag-state-in-context). Deliberately layout-agnostic:{" "}
        <code>ReorderableList</code> renders whatever container class you give it (a flex column, a CSS grid — the
        dashboard uses this to drag real widget cards in place, not a separate text list), and{" "}
        <code>ReorderableItem</code> wraps arbitrary children with no imposed visual style of its own.
      </DocLead>

      <ComponentPreview>
        <CardGridDemo />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Container layout is entirely the caller's — a grid of cards (dashboard widgets) or a plain vertical list, both shown on this page.",
            "Drop position is computed from pointer position vs. the target item's own midpoint.",
            "DragHandle and HideToggle are small shared visual primitives — use them, or roll your own controls entirely.",
            "useReorderableItemDragState(id) reads one item's own isDragging/isOver so a child can render its own drag feedback instead of relying on ReorderableItem's default outline.",
            "onReorder only fires when the order actually changed, never for a drag that ends where it started.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { ReorderableList, ReorderableItem, DragHandle, HideToggle } from "@spine/ui";

const [order, setOrder] = useState(["a", "b", "c"]);

<ReorderableList itemIds={order} onReorder={setOrder} className="grid grid-cols-2 gap-3">
  {order.map((id) => (
    <ReorderableItem key={id} id={id}>
      <div className="relative">
        <MyCard id={id} />
        <div className="absolute right-2 top-2 flex gap-1.5">
          <HideToggle hidden={false} onToggle={() => {}} />
          <DragHandle />
        </div>
      </div>
    </ReorderableItem>
  ))}
</ReorderableList>`}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Plain row list</DocLead>
        <ComponentPreview
          code={`<ReorderableList itemIds={order} onReorder={setOrder} className="flex flex-col gap-1.5">
  {order.map((id) => (
    <ReorderableItem key={id} id={id} className="flex items-center gap-2 rounded-md border px-3 py-2">
      <DragHandle />
      <span>{id}</span>
    </ReorderableItem>
  ))}
</ReorderableList>`}
        >
          <RowListDemo />
        </ComponentPreview>
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "ReorderableList.itemIds", type: "string[]", description: "Ordered ids, matching each item's own id." },
            { prop: "ReorderableList.onReorder", type: "(newOrder: string[]) => void", description: "Fires once a completed drag actually changes the order." },
            { prop: "ReorderableList.className", type: "string", description: "The container's own layout — flex column, CSS grid, etc." },
            { prop: "ReorderableItem.id", type: "string" },
            { prop: "ReorderableItem.className", type: "string", description: "Merged onto the drag wrapper — carries no default visual style." },
            { prop: "useReorderableItemDragState(id)", type: "{ isDragging, isOver }", description: "Read one item's own drag state for custom feedback." },
            { prop: "DragHandle", type: "component", description: "A grab-cursor grip icon." },
            { prop: "HideToggle", type: "component", description: "An eye/eye-off icon button. Props: hidden, onToggle." },
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
