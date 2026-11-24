"use client";

import { Badge, Timeline, type TimelineItemData } from "@spine/ui";
import { CheckSquare, FileText, Phone, StickyNote } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

const demoItems: TimelineItemData[] = [
  {
    id: "1",
    icon: <FileText size={14} />,
    tone: "success",
    title: "Quote QT-2026-014 accepted",
    description: "$18,500.00",
    timestamp: "2 days ago",
  },
  {
    id: "2",
    icon: <StickyNote size={14} />,
    title: "Note",
    description: "Discussed the revised timeline — customer wants to start mid-March.",
    timestamp: "3 days ago",
  },
  {
    id: "3",
    icon: <FileText size={14} />,
    title: "Quote QT-2026-014 sent",
    description: "$18,500.00",
    timestamp: "3 days ago",
  },
  {
    id: "4",
    icon: <Phone size={14} />,
    title: "Call",
    description: "Follow-up on the office refurbishment scope.",
    timestamp: "5 days ago",
  },
  {
    id: "5",
    icon: <CheckSquare size={14} />,
    title: "Task completed",
    meta: <Badge>Done</Badge>,
    timestamp: "1 week ago",
  },
  {
    id: "6",
    icon: <FileText size={14} />,
    tone: "critical",
    title: "Quote QT-2026-013 rejected",
    description: "$9,200.00",
    timestamp: "2 weeks ago",
  },
];

export default function TimelinePage() {
  return (
    <div>
      <DocTitle>Timeline</DocTitle>
      <DocLead>
        A vertical, connected feed of heterogeneous events — first built for a contact's merged
        quote + activity history (S-01.3), where a customer's quotes, calls, meetings, notes, and
        tasks all need to read as one chronological story rather than separate lists. Domain-agnostic
        by design: Timeline only knows how to lay out an icon, title, description, and timestamp with
        a connecting rail — the caller (e.g. the contact Timeline tab) merges and sorts events from
        however many real sources exist (quotes and activities today; invoices/payments once those
        modules land) before handing them to this component as one flat, pre-sorted array.
      </DocLead>

      <ComponentPreview>
        <Timeline items={demoItems} className="w-full max-w-lg" />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Renders items in the order given — Timeline doesn't sort, since a caller merging multiple event sources (quotes + activities) already needs to interleave and sort them by timestamp itself.",
            "Each item's icon and tone are fully caller-supplied — Timeline has no built-in notion of \"quote\" or \"activity\" event types, only a generic icon + optional tone (neutral/success/critical) for the connecting dot.",
            "tone maps to existing semantic tokens (paid/overdue), not arbitrary colors — reserve success/critical for an event that carries real status (an accepted or rejected quote), not routine entries.",
            "timestamp is any ReactNode, not a fixed date format — pass a pre-formatted relative time (e.g. via date-fns formatDistanceToNow) so locale/format stays the consuming app's decision.",
            "meta renders beside the timestamp for small trailing context, like a Badge marking a task done/open.",
            "The connecting rail between items is purely visual (an aria-hidden line) — screen readers get the list structure via the underlying <ol>, not the decorative line.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Timeline, type TimelineItemData } from "@spine/ui";
import { FileText, Phone } from "lucide-react";

const items: TimelineItemData[] = [
  {
    id: "quote-1-accepted",
    icon: <FileText size={14} />,
    tone: "success",
    title: "Quote QT-2026-014 accepted",
    description: "$18,500.00",
    timestamp: "2 days ago",
  },
  {
    id: "activity-1",
    icon: <Phone size={14} />,
    title: "Call",
    description: "Follow-up on scope.",
    timestamp: "5 days ago",
  },
];

export default () => <Timeline items={items} />;`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "items", type: "TimelineItemData[]" },
            { prop: "TimelineItemData.id", type: "string" },
            { prop: "TimelineItemData.icon", type: "ReactNode" },
            { prop: "TimelineItemData.title", type: "ReactNode" },
            { prop: "TimelineItemData.description", type: "ReactNode" },
            { prop: "TimelineItemData.timestamp", type: "ReactNode" },
            { prop: "TimelineItemData.meta", type: "ReactNode", description: "Rendered beside timestamp, e.g. a Badge." },
            { prop: "TimelineItemData.tone", type: '"neutral" | "success" | "critical"', defaultValue: '"neutral"' },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Contact Timeline tab (this app's actual usage)</DocLead>
        <ComponentPreview
          code={`// Merge two real sources, sort once, hand a flat array to Timeline.
const events = [
  ...quotes.flatMap((q) => quoteLifecycleEvents(q)),
  ...activities.map((a) => activityEvent(a)),
].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

<Timeline items={events} />`}
        >
          <Timeline items={demoItems.slice(0, 3)} className="w-full max-w-lg" />
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
