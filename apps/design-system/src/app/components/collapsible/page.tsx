"use client";

import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@spine/ui";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

function CollapsibleDemo() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-72">
      <CollapsibleTrigger asChild>
        <Button variant="secondary" size="sm">
          {open ? "Hide" : "Show"} raw payload
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-md border border-border bg-surface-sunken p-2 font-mono text-[12px] text-on-surface-muted">
        {"{ enrolmentId: \"abc123\", serverRev: 4 }"}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function CollapsiblePage() {
  return (
    <div>
      <DocTitle>Collapsible</DocTitle>
      <DocLead>
        An interactive component which expands/collapses a panel. The single-block primitive
        Accordion is built from — a togglable section on its own.
      </DocLead>

      <ComponentPreview>
        <CollapsibleDemo />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList items={["Can be controlled or uncontrolled.", "Full keyboard navigation."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@spine/ui";

export default () => (
  <Collapsible>
    <CollapsibleTrigger />
    <CollapsibleContent />
  </Collapsible>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "open", type: "boolean" },
            { prop: "defaultOpen", type: "boolean" },
            { prop: "onOpenChange", type: "(open: boolean) => void" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Collapsible open={open} onOpenChange={setOpen}>
  <CollapsibleTrigger asChild>
    <Button variant="secondary" size="sm">Show raw payload</Button>
  </CollapsibleTrigger>
  <CollapsibleContent>{JSON.stringify(payload)}</CollapsibleContent>
</Collapsible>`}
        >
          <CollapsibleDemo />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable rows={[{ keys: "Space", description: "Opens/closes the panel." }, { keys: "Enter", description: "Opens/closes the panel." }]} />
      </DocSection>
    </div>
  );
}
