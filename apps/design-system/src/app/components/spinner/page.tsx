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
        <FeatureList items={["Three sizes: sm, md, lg.", "Respects prefers-reduced-motion by relying on the browser's own reduced-motion handling for CSS animation."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Spinner } from "@spine/ui";

export default () => <Spinner />;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "size", type: "sm | md | lg", defaultValue: "md" }]} />
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
        <DocLead>Includes an aria-label of "Loading" — pair with a visually-hidden text description for a more specific announcement where useful.</DocLead>
      </DocSection>
    </div>
  );
}
