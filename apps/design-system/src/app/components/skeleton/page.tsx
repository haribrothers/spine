import { Skeleton } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function SkeletonPage() {
  return (
    <div>
      <DocTitle>Skeleton</DocTitle>
      <DocLead>
        A border-colored pulsing block matching the shape of the loading content — used for
        genuinely slow loads, not every async state.
      </DocLead>

      <ComponentPreview>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList items={["A plain sizable block — pass width/height utility classes to match the content it replaces."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Skeleton } from "@spine/ui";

export default () => <Skeleton className="h-4 w-48" />;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "…", type: "standard <div> attributes" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<div className="flex flex-col gap-2">
  <Skeleton className="h-4 w-48" />
  <Skeleton className="h-4 w-32" />
</div>`}
        >
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Purely visual — pair with an aria-busy region or a visually-hidden "Loading" label for screen readers where the loading state matters.</DocLead>
      </DocSection>
    </div>
  );
}
