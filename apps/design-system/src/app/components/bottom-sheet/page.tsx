"use client";

import { useState } from "react";
import { BottomSheet, Button } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function BottomSheetPage() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <DocTitle>BottomSheet</DocTitle>
      <DocLead>A panel that rises from the bottom of a phone: filters, pickers, the More menu, a line being edited (D-283). Built on Radix Dialog.</DocLead>

      <ComponentPreview>
        <Button onClick={() => setOpen(true)}>Open filters</Button>
        <BottomSheet
          open={open}
          onOpenChange={setOpen}
          title="Filters"
          footer={
            <>
              <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                Clear all
              </Button>
              <Button className="flex-[2]" onClick={() => setOpen(false)}>
                Show 3 invoices
              </Button>
            </>
          }
        >
          <p className="text-[14px] text-on-surface">Every filter and the sort go here.</p>
        </BottomSheet>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "A grabber, the title and Close; the content scrolls; an optional footer of buttons.",
            "Escape, Close, the dimmed page or a downward swipe on the header closes it.",
            "height=\"full\" takes the screen and hides the tab bar.",
            "With reduced motion it appears without sliding.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`<BottomSheet open={open} onOpenChange={setOpen} title="Filters" footer={…}>…</BottomSheet>`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "open · onOpenChange", type: "boolean · (open) => void" },
            { prop: "title", type: "string" },
            { prop: "description", type: "string — read, not shown" },
            { prop: "height", type: "\"auto\" | \"full\"" },
            { prop: "footer · headerAction", type: "ReactNode" },
          ]}
        />
      </DocSection>
    </div>
  );
}
