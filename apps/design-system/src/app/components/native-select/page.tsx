import { NativeSelect } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function NativeSelectPage() {
  return (
    <div>
      <DocTitle>NativeSelect</DocTitle>
      <DocLead>A plain native {"<select>"} for simple flat option lists — reach for the Radix-based Select for richer chrome or grouping needs.</DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["Uses the OS's own native dropdown chrome — the lightest-weight option when a custom-styled menu isn't needed."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { NativeSelect } from "@spine/ui";

export default () => (
  <NativeSelect>
    <option value="usd">USD</option>
  </NativeSelect>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "…", type: "standard <select> attributes" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<NativeSelect defaultValue="usd" className="w-40">
  <option value="usd">USD</option>
  <option value="eur">EUR</option>
  <option value="jpy">JPY</option>
</NativeSelect>`}
        >
          <NativeSelect defaultValue="usd" className="w-40">
            <option value="usd">USD</option>
            <option value="eur">EUR</option>
            <option value="jpy">JPY</option>
          </NativeSelect>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>Inherits full native keyboard/screen-reader support automatically since it's a real {"<select>"} element.</DocLead>
      </DocSection>
    </div>
  );
}
