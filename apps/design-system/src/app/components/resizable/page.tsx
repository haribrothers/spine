import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function ResizablePage() {
  return (
    <div>
      <DocTitle>Resizable</DocTitle>
      <DocLead>Accessible resizable panel groups and layouts, built on react-resizable-panels.</DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["Supports horizontal and vertical orientation.", "Persists layout via the underlying library's own storage hooks if wired up.", "Optional visible grip handle."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@spine/ui";

export default () => (
  <ResizablePanelGroup>
    <ResizablePanel />
    <ResizableHandle />
    <ResizablePanel />
  </ResizablePanelGroup>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "ResizablePanelGroup.orientation", type: "horizontal | vertical", defaultValue: "horizontal" },
            { prop: "ResizablePanel.defaultSize", type: "number (percentage)" },
            { prop: "ResizableHandle.withHandle", type: "boolean", defaultValue: "false" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<ResizablePanelGroup className="h-48 rounded-md border border-border">
  <ResizablePanel defaultSize={30}>
    <div className="p-3 text-[13px]">Sidebar</div>
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={70}>
    <div className="p-3 text-[13px]">Content</div>
  </ResizablePanel>
</ResizablePanelGroup>`}
        >
          <ResizablePanelGroup className="h-48 rounded-md border border-border">
            <ResizablePanel defaultSize={30}>
              <div className="p-3 text-[13px] text-on-surface">Sidebar</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={70}>
              <div className="p-3 text-[13px] text-on-surface">Content</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>The resize handle is keyboard-operable via arrow keys once focused.</DocLead>
      </DocSection>
    </div>
  );
}
