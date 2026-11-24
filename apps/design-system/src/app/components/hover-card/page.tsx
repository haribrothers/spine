import { Avatar, AvatarFallback, HoverCard, HoverCardContent, HoverCardTrigger } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function HoverCardPage() {
  return (
    <div>
      <DocTitle>HoverCard</DocTitle>
      <DocLead>
        For sighted users to preview content available behind a link. Sits between Tooltip and
        Popover — a richer preview (e.g. a contact's name → mini activity summary) on hover,
        still supplementary.
      </DocLead>

      <ComponentPreview>
        <HoverCard>
          <HoverCardTrigger className="text-[13px] text-primary underline underline-offset-2">
            Acme Contracting Ltd.
          </HoverCardTrigger>
          <HoverCardContent>
            <div className="flex items-center gap-2">
              <Avatar size="sm">
                <AvatarFallback>AC</AvatarFallback>
              </Avatar>
              <div className="text-[13px]">
                <p className="font-medium text-on-surface">Acme Contracting Ltd.</p>
                <p className="text-on-surface-muted">3 open invoices · $4,120 outstanding</p>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList items={["Configurable open/close delay.", "Supports hover and focus.", "Customize side, alignment, offsets, collision handling."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { HoverCard, HoverCardTrigger, HoverCardContent } from "@spine/ui";

export default () => (
  <HoverCard>
    <HoverCardTrigger />
    <HoverCardContent />
  </HoverCard>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "openDelay", type: "number", defaultValue: "700" },
            { prop: "closeDelay", type: "number", defaultValue: "300" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<HoverCard>
  <HoverCardTrigger className="text-primary underline underline-offset-2">
    Acme Contracting Ltd.
  </HoverCardTrigger>
  <HoverCardContent>
    <div className="flex items-center gap-2">
      <Avatar size="sm"><AvatarFallback>AC</AvatarFallback></Avatar>
      <div>
        <p className="font-medium">Acme Contracting Ltd.</p>
        <p className="text-on-surface-muted">3 open invoices · $4,120 outstanding</p>
      </div>
    </div>
  </HoverCardContent>
</HoverCard>`}
        >
          <HoverCard>
            <HoverCardTrigger className="text-[13px] text-primary underline underline-offset-2">
              Acme Contracting Ltd.
            </HoverCardTrigger>
            <HoverCardContent>
              <div className="flex items-center gap-2">
                <Avatar size="sm">
                  <AvatarFallback>AC</AvatarFallback>
                </Avatar>
                <div className="text-[13px]">
                  <p className="font-medium text-on-surface">Acme Contracting Ltd.</p>
                  <p className="text-on-surface-muted">3 open invoices · $4,120 outstanding</p>
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Supplementary preview content only — never the sole path to information a user needs,
          since touch devices have no hover state.
        </DocLead>
      </DocSection>
    </div>
  );
}
