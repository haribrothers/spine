import { Tabs, TabsContent, TabsList, TabsTrigger } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function TabsPage() {
  return (
    <div>
      <DocTitle>Tabs</DocTitle>
      <DocLead>
        A set of layered sections of content — known as tab panels — that display one panel at
        a time. Underline-indicator style, for switching between views within one page — e.g. a
        job's Overview/Milestones/Photos tabs.
      </DocLead>

      <ComponentPreview>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-[13px] text-on-surface">
            Job overview content.
          </TabsContent>
          <TabsContent value="milestones" className="text-[13px] text-on-surface">
            Milestone list.
          </TabsContent>
          <TabsContent value="photos" className="text-[13px] text-on-surface">
            Site photos.
          </TabsContent>
        </Tabs>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Can be controlled or uncontrolled.",
            "Supports horizontal/vertical orientation.",
            "Full keyboard navigation.",
            "Supports automatic/manual activation.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Tabs, TabsList, TabsTrigger, TabsContent } from "@spine/ui";

export default () => (
  <Tabs defaultValue="tab1">
    <TabsList>
      <TabsTrigger value="tab1" />
    </TabsList>
    <TabsContent value="tab1" />
  </Tabs>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "value", type: "string" },
            { prop: "defaultValue", type: "string" },
            { prop: "onValueChange", type: "(value: string) => void" },
            { prop: "activationMode", type: "automatic | manual", defaultValue: "automatic" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="milestones">Milestones</TabsTrigger>
    <TabsTrigger value="photos">Photos</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">Job overview content.</TabsContent>
  <TabsContent value="milestones">Milestone list.</TabsContent>
  <TabsContent value="photos">Site photos.</TabsContent>
</Tabs>`}
        >
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="milestones">Milestones</TabsTrigger>
              <TabsTrigger value="photos">Photos</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="text-[13px] text-on-surface">
              Job overview content.
            </TabsContent>
            <TabsContent value="milestones" className="text-[13px] text-on-surface">
              Milestone list.
            </TabsContent>
            <TabsContent value="photos" className="text-[13px] text-on-surface">
              Site photos.
            </TabsContent>
          </Tabs>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Adheres to the{" "}
          <a href="https://www.w3.org/WAI/ARIA/apg/patterns/tabs/" className="text-primary underline underline-offset-2">
            ARIA Tabs
          </a>{" "}
          pattern.
        </DocLead>
        <KeyboardTable
          rows={[
            { keys: "Tab", description: "Moves focus to the active tab, or the first tab if none is active." },
            { keys: "ArrowRight", description: "Moves focus and activates the next tab (horizontal)." },
            { keys: "ArrowLeft", description: "Moves focus and activates the previous tab (horizontal)." },
            { keys: "Home", description: "Moves focus and activates the first tab." },
            { keys: "End", description: "Moves focus and activates the last tab." },
          ]}
        />
      </DocSection>
    </div>
  );
}
