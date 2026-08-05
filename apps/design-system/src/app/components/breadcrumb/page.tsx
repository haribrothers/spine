import { Breadcrumb } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function BreadcrumbPage() {
  return (
    <div>
      <DocTitle>Breadcrumb</DocTitle>
      <DocLead>A trail of links showing the current page's ancestry. body-sm typography, muted grey with the current page in on-surface.</DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["The last item (no href) renders as plain, non-interactive text for the current page."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Breadcrumb } from "@spine/ui";

export default () => <Breadcrumb items={[{ label: "Jobs", href: "/jobs" }, { label: "Riverside" }]} />;`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "items", type: "{ label: string; href?: string }[]" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Breadcrumb
  items={[
    { label: "Jobs", href: "/jobs" },
    { label: "Riverside Extension", href: "/jobs/riverside" },
    { label: "Milestones" },
  ]}
/>`}
        >
          <Breadcrumb
            items={[
              { label: "Jobs", href: "/jobs" },
              { label: "Riverside Extension", href: "/jobs/riverside" },
              { label: "Milestones" },
            ]}
          />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Rendered inside a{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{'<nav aria-label="Breadcrumb">'}</code>{" "}
          landmark.
        </DocLead>
      </DocSection>
    </div>
  );
}
