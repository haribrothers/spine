import { Toolbar, ToolbarButton, ToolbarSeparator, ToolbarToggleGroup, ToolbarToggleItem } from "@spine/ui";
import { Bold, Italic, Underline } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function ToolbarPage() {
  return (
    <div>
      <DocTitle>Toolbar</DocTitle>
      <DocLead>A container for grouping a set of controls, such as buttons, toggle groups, or dropdown menus.</DocLead>

      <ComponentPreview>
        <Toolbar>
          <ToolbarToggleGroup type="multiple">
            <ToolbarToggleItem value="bold" aria-label="Bold">
              <Bold size={14} />
            </ToolbarToggleItem>
            <ToolbarToggleItem value="italic" aria-label="Italic">
              <Italic size={14} />
            </ToolbarToggleItem>
            <ToolbarToggleItem value="underline" aria-label="Underline">
              <Underline size={14} />
            </ToolbarToggleItem>
          </ToolbarToggleGroup>
          <ToolbarSeparator />
          <ToolbarButton>Clear formatting</ToolbarButton>
        </Toolbar>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList items={["Supports horizontal and vertical orientation.", "Full keyboard navigation with roving tabindex across all toolbar controls."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Toolbar, ToolbarButton, ToolbarSeparator, ToolbarToggleGroup, ToolbarToggleItem } from "@spine/ui";

export default () => (
  <Toolbar>
    <ToolbarToggleGroup type="single">
      <ToolbarToggleItem value="bold" />
    </ToolbarToggleGroup>
    <ToolbarSeparator />
    <ToolbarButton />
  </Toolbar>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "orientation", type: "horizontal | vertical", defaultValue: "horizontal" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Toolbar>
  <ToolbarToggleGroup type="multiple">
    <ToolbarToggleItem value="bold" aria-label="Bold"><Bold size={14} /></ToolbarToggleItem>
    <ToolbarToggleItem value="italic" aria-label="Italic"><Italic size={14} /></ToolbarToggleItem>
    <ToolbarToggleItem value="underline" aria-label="Underline"><Underline size={14} /></ToolbarToggleItem>
  </ToolbarToggleGroup>
  <ToolbarSeparator />
  <ToolbarButton>Clear formatting</ToolbarButton>
</Toolbar>`}
        >
          <Toolbar>
            <ToolbarToggleGroup type="multiple">
              <ToolbarToggleItem value="bold" aria-label="Bold">
                <Bold size={14} />
              </ToolbarToggleItem>
              <ToolbarToggleItem value="italic" aria-label="Italic">
                <Italic size={14} />
              </ToolbarToggleItem>
              <ToolbarToggleItem value="underline" aria-label="Underline">
                <Underline size={14} />
              </ToolbarToggleItem>
            </ToolbarToggleGroup>
            <ToolbarSeparator />
            <ToolbarButton>Clear formatting</ToolbarButton>
          </Toolbar>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable
          rows={[
            { keys: "Tab", description: "Moves focus into/out of the toolbar as a single stop." },
            { keys: "ArrowRight", description: "Moves focus to the next control." },
            { keys: "ArrowLeft", description: "Moves focus to the previous control." },
          ]}
        />
      </DocSection>
    </div>
  );
}
