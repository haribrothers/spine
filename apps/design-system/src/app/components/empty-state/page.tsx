import { Button, EmptyState } from "@spine/ui";
import { Inbox } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function EmptyStatePage() {
  return (
    <div>
      <DocTitle>EmptyState</DocTitle>
      <DocLead>
        Used for every zero-results list and the first-run dashboard — Spine's onboarding
        principle is "never a blank screen with no next action."
      </DocLead>

      <DocSection id="default" title="Default">
        <ComponentPreview
          code={`<EmptyState
  icon={<Inbox />}
  title="No quotes yet"
  description="Create your first quote to start the enquiry-to-invoice workflow."
  action={<Button>Create quote</Button>}
/>`}
        >
          <EmptyState
            icon={<Inbox />}
            title="No quotes yet"
            description="Create your first quote to start the enquiry-to-invoice workflow."
            action={<Button>Create quote</Button>}
          />
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
