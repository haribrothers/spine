import { Badge } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function BadgePage() {
  return (
    <div>
      <DocTitle>Badge</DocTitle>
      <DocLead>
        A compact neutral-toned indicator for counts/tags/generic status. Visually similar to
        StatusChip but never used for financial status.
      </DocLead>

      <DocSection id="default" title="Default">
        <ComponentPreview code={`<Badge>Beta</Badge>
<Badge>12</Badge>`}>
          <div className="flex items-center gap-3">
            <Badge>Beta</Badge>
            <Badge>12</Badge>
          </div>
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
