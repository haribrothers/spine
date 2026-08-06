import { Spinner } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function SpinnerPage() {
  return (
    <div>
      <DocTitle>Spinner</DocTitle>
      <DocLead>
        An indeterminate loading indicator for actions with no known duration — e.g. "sending
        invoice…". Prefer Skeleton for content that has a known shape.
      </DocLead>

      <ComponentPreview>
        <div className="flex items-center gap-3">
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </div>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Three sizes: sm, md, lg.",
            "Respects prefers-reduced-motion by relying on the browser's own reduced-motion handling for CSS animation.",
            "Wrapped in a role=\"status\" span with an aria-label — the bare <svg> icon carries aria-hidden, since an SVG has no implicit ARIA role and can't reliably carry its own accessible name in every screen reader.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Spinner } from "@spine/ui";

export default () => <Spinner />;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "size", type: "sm | md | lg", defaultValue: "md" },
            { prop: "label", type: "string", defaultValue: '"Loading"' },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Sizes</DocLead>
        <ComponentPreview code={`<Spinner size="sm" />\n<Spinner size="md" />\n<Spinner size="lg" />`}>
          <div className="flex items-center gap-3">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </div>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Renders <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">role=&quot;status&quot;</code> with
          an <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">aria-label</code> of &quot;Loading&quot; by
          default — pass a more specific <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">label</code>{" "}
          (e.g. &quot;Sending invoice…&quot;) where useful, so assistive tech gets a polite announcement without focus moving anywhere.
        </DocLead>
      </DocSection>
    </div>
  );
}
