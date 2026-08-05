import { Breadcrumb } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function BreadcrumbPage() {
  return (
    <div>
      <DocTitle>Breadcrumb</DocTitle>
      <DocLead>body-sm typography, muted grey with the current page in on-surface.</DocLead>

      <DocSection id="default" title="Default">
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
    </div>
  );
}
