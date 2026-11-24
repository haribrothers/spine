"use client";

import { Stepper } from "@spine/ui";
import { useState } from "react";
import { Button } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

const DEMO_STEPS = [
  { key: "profile", label: "Business" },
  { key: "template", label: "Template" },
  { key: "currency", label: "Currency" },
  { key: "tax", label: "Tax" },
];

function StepperDemo() {
  const [index, setIndex] = useState(1);
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <Stepper steps={DEMO_STEPS} currentIndex={index} />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          Back
        </Button>
        <Button
          size="sm"
          onClick={() => setIndex((i) => Math.min(DEMO_STEPS.length, i + 1))}
          disabled={index === DEMO_STEPS.length}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default function StepperPage() {
  return (
    <div>
      <DocTitle>Stepper</DocTitle>
      <DocLead>
        A numbered progress indicator for linear multi-step flows — wizards, checkout-style
        forms. Numbered circles connected by a line, a checkmark on completed steps, the current
        step highlighted. Promoted from the onboarding wizard (F12), its original and still only
        call site.
      </DocLead>

      <ComponentPreview>
        <StepperDemo />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Numbered circles for upcoming/current steps, a checkmark (lucide's Check) for completed ones.",
            "A connecting line between steps fills the same border-strong token as the un-reached circle border.",
            "The current step's label is medium-weight and full-opacity; other labels are muted.",
            "Step labels hide below the sm breakpoint, leaving just the numbered/checked circles for narrow viewports.",
            "Purely presentational — indicates progress, it is not a set of interactive controls.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Stepper } from "@spine/ui";

const steps = [
  { key: "profile", label: "Business" },
  { key: "template", label: "Template" },
  { key: "currency", label: "Currency" },
];

export default () => <Stepper steps={steps} currentIndex={1} />;`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "steps", type: "{ key: string; label: string }[]" },
            { prop: "currentIndex", type: "number" },
            { prop: "className", type: "string" },
          ]}
        />
        <DocLead>
          A step at an index less than <code>currentIndex</code> renders complete (checkmark,
          filled circle). The step at <code>currentIndex</code> renders current (outlined circle,
          bold label). Steps after it render upcoming (muted).
        </DocLead>
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview code={`<Stepper steps={steps} currentIndex={1} />`}>
          <Stepper steps={DEMO_STEPS} currentIndex={1} />
        </ComponentPreview>

        <DocLead>All steps complete</DocLead>
        <ComponentPreview code={`<Stepper steps={steps} currentIndex={steps.length} />`}>
          <Stepper steps={DEMO_STEPS} currentIndex={DEMO_STEPS.length} />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          This is a status indicator, not a navigation control — steps are not clickable and
          carry no button semantics, matching the onboarding wizard&apos;s actual behavior (you
          cannot click an earlier step to jump back to it; the only way back is the step&apos;s
          own in-page &quot;Back&quot;/&quot;Skip&quot; actions). The list carries{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">
            aria-label=&quot;Progress&quot;
          </code>{" "}
          on the outer{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">
            {"<ol>"}
          </code>
          , and the current step carries{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">
            aria-current=&quot;step&quot;
          </code>{" "}
          so assistive tech can announce which step is active without relying on color alone. The
          connecting line and per-step checkmark/number/label combination means progress is never
          conveyed by color alone. If a future flow needs click-to-navigate between steps, that
          calls for a distinct interactive variant with real button semantics and keyboard
          activation (Enter/Space) — not a purely-visual change to this component.
        </DocLead>
      </DocSection>
    </div>
  );
}
