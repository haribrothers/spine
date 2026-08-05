import { Tabs, TabsContent, TabsList, TabsTrigger } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function TabsPage() {
  return (
    <div>
      <DocTitle>Tabs</DocTitle>
      <DocLead>
        Underline-indicator style, for switching between views within one page — e.g. a job's
        Overview/Milestones/Photos tabs.
      </DocLead>

      <DocSection id="default" title="Default">
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
    </div>
  );
}
