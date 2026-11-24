"use client";

import { Button, PageLoader } from "@spine/ui";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocSubsection, DocTitle, FeatureList } from "@/components/doc-page";

function FullScreenDemo() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button onClick={() => setLoading(true)}>Simulate page load</Button>
      {loading && <PageLoader fullScreen label="Loading contacts" />}
      {loading && (
        <button
          type="button"
          className="text-[12px] text-on-surface-muted underline"
          onClick={() => setLoading(false)}
        >
          Dismiss demo
        </button>
      )}
    </div>
  );
}

export default function PageLoaderPage() {
  return (
    <div>
      <DocTitle>PageLoader</DocTitle>
      <DocLead>
        The "an operation is happening" indicator for a whole page or panel — show it any time a
        route, drawer, or section is fetching or submitting and there's nothing meaningful to
        render yet. Use <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">Spinner</code> instead
        for a single button's busy state, and <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">Skeleton</code> when
        the content's shape is already known.
      </DocLead>

      <ComponentPreview>
        <div className="relative h-40 w-full">
          <PageLoader />
        </div>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Two modes: inline (absolute, fills the nearest positioned ancestor) and fullScreen (fixed to the viewport).",
            "Translucent surface-tinted backdrop with a blur, so underlying content stays legible as context rather than disappearing.",
            "fullScreen sits at z-overlay — one layer below z-modal — so a loader triggered from inside a Dialog/Drawer never outranks it.",
            "Built on Spinner, so it inherits the same polite role=\"status\" live-region behavior.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { PageLoader } from "@spine/ui";

export default () => <PageLoader />;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "label", type: "string", defaultValue: '"Loading"' },
            { prop: "fullScreen", type: "boolean", defaultValue: "false" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocSubsection id="inline" title="Inline (panel-level)">
          <DocLead>
            The default — renders <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">absolute inset-0</code>,
            so its parent needs <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">relative</code> positioning
            and an explicit height. This is the shape most list/detail panels want while a
            request is in flight.
          </DocLead>
          <ComponentPreview code={`<div className="relative h-40">\n  <PageLoader label="Loading contacts" />\n</div>`}>
            <div className="relative h-40 w-full">
              <PageLoader label="Loading contacts" />
            </div>
          </ComponentPreview>
        </DocSubsection>

        <DocSubsection id="full-screen" title="Full screen">
          <DocLead>
            For a page-level navigation or a long-running submit where the whole viewport should
            block interaction — e.g. finalizing an invoice.
          </DocLead>
          <ComponentPreview code={`<PageLoader fullScreen label="Loading contacts" />`}>
            <FullScreenDemo />
          </ComponentPreview>
        </DocSubsection>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Inherits Spinner's <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">role="status"</code> live
          region — pass a specific <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">label</code> (e.g.
          "Loading contacts") so assistive tech announces what's in progress, not just "Loading."
        </DocLead>
      </DocSection>
    </div>
  );
}
