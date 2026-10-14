"use client";

import { useMemo, useState } from "react";
import { Badge, Button, KanbanBoard, KanbanCard, KanbanColumn } from "@spine/ui";
import { Plus } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

type Stage = "new" | "qualified" | "proposal" | "won" | "lost";

const STAGES: { id: Stage; label: string }[] = [
  { id: "new", label: "New" },
  { id: "qualified", label: "Qualified" },
  { id: "proposal", label: "Proposal" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

interface DemoLead {
  id: string;
  title: string;
  contact: string;
  stage: Stage;
  value: number;
}

const initialLeads: DemoLead[] = [
  { id: "1", title: "Warehouse fit-out", contact: "Acme Contracting Ltd.", stage: "new", value: 42000 },
  { id: "2", title: "Office refurbishment", contact: "Brightline Interiors", stage: "qualified", value: 18500 },
  { id: "3", title: "Steel frame supply", contact: "Coastal Fabrication Co.", stage: "qualified", value: 9200 },
  { id: "4", title: "Retail unit build-out", contact: "Delta Electrical Services", stage: "proposal", value: 27500 },
  { id: "5", title: "Annual maintenance contract", contact: "Everline Plumbing", stage: "won", value: 6400 },
  { id: "6", title: "Speculative extension quote", contact: "Acme Contracting Ltd.", stage: "lost", value: 15800 },
];

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function KanbanDemo() {
  const [leads, setLeads] = useState(initialLeads);
  const [expanded, setExpanded] = useState<Stage[]>([]);
  const [opened, setOpened] = useState<string | null>(null);

  const columns = useMemo(() => {
    const grouped = new Map<Stage, DemoLead[]>(STAGES.map((s) => [s.id, []]));
    for (const lead of leads) grouped.get(lead.stage)?.push(lead);
    return grouped;
  }, [leads]);

  function moveLead(id: string, stage: Stage) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));
  }

  const toggle = (id: Stage) => setExpanded((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  return (
    <div className="flex h-[440px] flex-col gap-2">
      <p className="text-[12.5px] text-on-surface-muted" aria-live="polite">
        {opened ? `Opened ${opened}` : "Press a card (or Tab to it and press Enter) to open it; press Won or Lost to show them."}
      </p>
      <KanbanBoard className="min-h-0 flex-1">
        {STAGES.map(({ id, label }) => {
          const stageLeads = columns.get(id) ?? [];
          const total = stageLeads.reduce((sum, l) => sum + l.value, 0);
          const closed = id === "won" || id === "lost";
          if (closed && !expanded.includes(id)) {
            return (
              <KanbanColumn
                key={id}
                collapsed
                title={label}
                meta={stageLeads.length}
                subtitle={formatMoney(total)}
                expandLabel={`Show ${label}, ${stageLeads.length} leads`}
                onExpand={() => toggle(id)}
                onDrop={(cardId) => moveLead(cardId, id)}
              />
            );
          }
          return (
            <KanbanColumn
              key={id}
              title={label}
              meta={stageLeads.length}
              subtitle={total > 0 ? formatMoney(total) : undefined}
              minWidth={160}
              headerAction={
                closed ? (
                  <Button variant="ghost" size="sm" onClick={() => toggle(id)}>
                    Hide
                  </Button>
                ) : undefined
              }
              onDrop={(cardId) => moveLead(cardId, id)}
            >
              {stageLeads.map((lead) => (
                <KanbanCard key={lead.id} id={lead.id} label={`${lead.title}, ${lead.contact}`} onOpen={() => setOpened(lead.title)}>
                  <span className="font-medium text-on-surface">{lead.title}</span>
                  <span className="text-on-surface-muted">{lead.contact}</span>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-on-surface-muted">{formatMoney(lead.value)}</span>
                    <Badge>site visit</Badge>
                  </div>
                </KanbanCard>
              ))}
            </KanbanColumn>
          );
        })}
      </KanbanBoard>
    </div>
  );
}

export default function KanbanPage() {
  return (
    <div>
      <DocTitle>Kanban</DocTitle>
      <DocLead>
        A domain-agnostic drag-and-drop board — <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">KanbanBoard</code>,{" "}
        <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">KanbanColumn</code> and{" "}
        <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">KanbanCard</code> —
        for any stage-based pipeline (leads by stage today; a future jobs or hiring board could reuse
        the same three pieces). Built on native HTML5 drag-and-drop rather than a dependency, since a
        handful of columns and cards doesn't need a full DnD library. The board itself never scrolls —
        only each column's card list does — so a column with many cards never pushes the whole board
        taller than its container.
      </DocLead>

      <ComponentPreview>
        <KanbanDemo />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Drag a card from one column and drop it on another to move it — KanbanColumn's onDrop receives the dragged card's id; what a \"move\" means (a PUT request, local state, etc.) is entirely the caller's concern.",
            "Each column has a fixed height (100% of the board) and its own independently scrolling card list via ScrollArea — the board's overall height never grows with card count.",
            "title/meta/subtitle are free-form ReactNode, not fixed to \"name + count\" — meta is typically a count, subtitle a running value total, but neither is required.",
            "A column being dragged over highlights (border-primary + bg-info-bg) so the drop target is obvious; a column can also take its own className to signal a distinct state (e.g. a \"Lost\" stage tinted with the overdue tokens).",
            "KanbanCard's onClick is untouched by drag handling (native drag/click are distinguished by the browser's own movement threshold), so cards can open an edit dialog on click while still being draggable.",
            "Columns flex to fill the board's full width by default (floored at minWidth, 275px) — a handful of stages spread out to use all available space with no unnecessary scrolling; pass a fixed width to opt a column out of flexing instead.",
            "US-CRM-24: collapsed turns a column into a slim (56px), full-height button showing its accent, count, name and subtitle running upwards; pressing it calls onExpand, and cards can still be dropped on it. headerAction puts a control (e.g. Hide) at the right of an open column's header.",
            "US-CRM-24: when the columns overflow sideways, a soft shadow at the edge with more says so.",
            "US-CRM-25: with onOpen the whole card is one button (Tab to it, Enter or Space opens it; label is its accessible name), and menu sits beside that button at the top right, never inside it. onMenuKey fires on the menu key or Shift+F10.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { KanbanBoard, KanbanColumn, KanbanCard } from "@spine/ui";

export default () => (
  <div className="h-[600px]">
    <KanbanBoard className="h-full">
      <KanbanColumn
        title="Qualified"
        meta={leads.length}
        subtitle={formatMoney(total)}
        onDrop={(cardId) => moveLead(cardId, "qualified")}
      >
        {leads.map((lead) => (
          <KanbanCard key={lead.id} id={lead.id} onClick={() => openEditDialog(lead)}>
            {lead.title}
          </KanbanCard>
        ))}
      </KanbanColumn>
    </KanbanBoard>
  </div>
);`}
        />
      </DocSection>

      <DocSection id="sizing" title="Sizing">
        <DocLead>
          KanbanBoard fills its parent's height (<code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">h-full</code>)
          rather than computing a viewport-relative height itself — wrap it in a container with an
          explicit or measured height (the Leads pipeline page measures from the board's top to the
          bottom of the window, so every column runs full height under the header, summary and toolbar) so "the board doesn't scroll,
          only cards inside a column do" actually holds — without an explicit height on an ancestor,
          a bare <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">h-full</code> collapses to zero.
        </DocLead>
        <DocLead>
          Width works the same way in reverse: columns flex to fill whatever width the board is
          given, so a page hosting a wide board should also opt out of{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">AppShellContent</code>'s
          default 1200px cap via its <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">fullWidth</code> prop
          (the Leads pipeline page does this) — otherwise the columns simply flex to fill a
          narrower-than-necessary 1200px column instead of the real viewport.
        </DocLead>
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "KanbanBoard children", type: "ReactNode", description: "KanbanColumn elements." },
            { prop: "KanbanColumn title", type: "ReactNode" },
            { prop: "KanbanColumn meta", type: "ReactNode", description: "Shown beside the title — typically a count." },
            { prop: "KanbanColumn subtitle", type: "ReactNode", description: "Shown below the title — typically a value total." },
            { prop: "KanbanColumn onDrop", type: "(cardId: string) => void" },
            { prop: "KanbanColumn width", type: "number", description: "Fixed width in px — when set, the column no longer flexes." },
            { prop: "KanbanColumn minWidth", type: "number", defaultValue: "275", description: "Floor width in px when width is omitted (flexible mode)." },
            { prop: "KanbanCard id", type: "string" },
            { prop: "KanbanColumn accent", type: "ReactNode", description: "Shown before the title — e.g. a stage colour dot." },
            { prop: "KanbanColumn headerAction", type: "ReactNode", description: "Shown at the right of the header — e.g. a button that collapses the column." },
            { prop: "KanbanColumn collapsed", type: "boolean", defaultValue: "false", description: "A slim, full-height column that's one button; children aren't shown." },
            { prop: "KanbanColumn onExpand", type: "() => void", description: "Called when a collapsed column is pressed." },
            { prop: "KanbanColumn expandLabel", type: "string", description: "The collapsed column's accessible name, e.g. \"Show Won, 3 leads\"." },
            { prop: "KanbanCard onClick", type: "() => void", description: "Free for the caller — e.g. opening an edit dialog." },
            { prop: "KanbanCard onOpen", type: "() => void", description: "Makes the card one focusable button that opens it on click, Enter or Space." },
            { prop: "KanbanCard label", type: "string", description: "The card button's accessible name." },
            { prop: "KanbanCard menu", type: "ReactNode", description: "A menu at the top right, beside the card's button." },
            { prop: "KanbanCard onMenuKey", type: "() => void", description: "The menu key or Shift+F10 on the focused card." },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Leads pipeline (this app's actual usage)</DocLead>
        <ComponentPreview
          code={`<KanbanBoard>
  {stages.map((stage) =>
    stage.kind !== "open" && !expanded.has(stage.id) ? (
      <KanbanColumn
        key={stage.id}
        collapsed
        title={stage.name}
        accent={<Dot color={stage.color} />}
        meta={recent.length}
        subtitle={\`\${formatMoney(total, currency)} · 30 days\`}
        expandLabel={\`Show \${stage.name}: \${recent.length} leads in the last 30 days\`}
        onExpand={() => toggle(stage.id)}
        onDrop={(cardId) => moveLead(cardId, stage)}
      />
    ) : (
      <KanbanColumn key={stage.id} title={stage.name} accent={<Dot color={stage.color} />} meta={stageLeads.length} minWidth={128} onDrop={(cardId) => moveLead(cardId, stage)}>
        {stageLeads.map((lead) => (
          <KanbanCard key={lead.id} id={lead.id} label={lead.title} onOpen={() => openDrawer(lead)} menu={<LeadMenu lead={lead} />}>
            {lead.title}
          </KanbanCard>
        ))}
      </KanbanColumn>
    ),
  )}
</KanbanBoard>`}
        >
          <Button variant="secondary" size="sm">
            <Plus size={14} />
            See it live under Sales → Pipeline in the app
          </Button>
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
