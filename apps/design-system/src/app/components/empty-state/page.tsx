import { Button, EmptyState } from "@spine/ui";
import { Inbox } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function EmptyStatePage() {
  return (
    <div>
      <DocTitle>EmptyState</DocTitle>
      <DocLead>
        Used for every zero-results list and the first-run dashboard — Spine's onboarding
        principle is "never a blank screen with no next action."
      </DocLead>

      <ComponentPreview>
        <EmptyState
          icon={<Inbox />}
          title="No quotes yet"
          description="Create your first quote to start the enquiry-to-invoice workflow."
          action={<Button>Create quote</Button>}
        />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Centered icon, heading, optional description, and optional primary action.",
            "The action slot accepts any node, typically a Button, so it composes rather than reimplementing button styling.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { EmptyState } from "@spine/ui";

export default () => <EmptyState title="No quotes yet" />;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "icon", type: "ReactNode" },
            { prop: "title", type: "string" },
            { prop: "description", type: "string" },
            { prop: "action", type: "ReactNode" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
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

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>The icon is decorative; the heading carries the actual meaning for screen readers.</DocLead>
      </DocSection>
    </div>
  );
}
