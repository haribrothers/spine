import { Avatar, AvatarFallback } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function AvatarPage() {
  return (
    <div>
      <DocTitle>Avatar</DocTitle>
      <DocLead>An image element with a fallback for representing a user or organization. Circular, initials-on-primary-fill by default, or an image when available.</DocLead>

      <ComponentPreview>
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

      <DocSection id="features" title="Features">
        <FeatureList items={["Automatic fallback while an image is loading or if it fails to load.", "Three sizes: sm, md, lg."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Avatar, AvatarImage, AvatarFallback } from "@spine/ui";

export default () => (
  <Avatar>
    <AvatarImage src="…" />
    <AvatarFallback>JD</AvatarFallback>
  </Avatar>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "size", type: "sm | md | lg", defaultValue: "md" },
            { prop: "AvatarImage.src", type: "string" },
            { prop: "AvatarFallback.delayMs", type: "number" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Sizes</DocLead>
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

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Pass a meaningful <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">alt</code>{" "}
          on <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">AvatarImage</code> — the
          fallback initials alone aren't announced as the person's name.
        </DocLead>
      </DocSection>
    </div>
  );
}
