import { Avatar, AvatarFallback } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function AvatarPage() {
  return (
    <div>
      <DocTitle>Avatar</DocTitle>
      <DocLead>Circular, initials-on-primary-fill by default, or an image when available.</DocLead>

      <DocSection id="sizes" title="Sizes">
        <ComponentPreview
          code={`<Avatar size="sm"><AvatarFallback>JD</AvatarFallback></Avatar>
<Avatar size="md"><AvatarFallback>JD</AvatarFallback></Avatar>
<Avatar size="lg"><AvatarFallback>JD</AvatarFallback></Avatar>`}
        >
          <div className="flex items-center gap-3">
            <Avatar size="sm">
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <Avatar size="md">
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <Avatar size="lg">
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
          </div>
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
