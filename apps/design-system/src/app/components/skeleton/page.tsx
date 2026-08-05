import { Skeleton } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function SkeletonPage() {
  return (
    <div>
      <DocTitle>Skeleton</DocTitle>
      <DocLead>
        A border-colored pulsing block matching the shape of the loading content — used for
        genuinely slow loads, not every async state.
      </DocLead>

      <DocSection id="default" title="Default">
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
    </div>
  );
}
