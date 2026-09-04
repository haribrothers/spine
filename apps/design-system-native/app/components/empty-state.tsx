import Inbox from "lucide-react-native/icons/inbox";
import { Button, EmptyState, useTheme } from "@spine/ui-native";
import { darkColors, lightColors } from "@spine/ui-native/tokens";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

export function EmptyStateScreen() {
  const { resolvedMode } = useTheme();
  const iconColor = resolvedMode === "dark" ? darkColors.onSurfaceMuted : lightColors.onSurfaceMuted;

  return (
    <DocScreen>
      <DocTitle>EmptyState</DocTitle>
      <DocLead>
        Used for every zero-results list and the first-run dashboard — Spine&apos;s onboarding principle is
        &quot;never a blank screen with no next action.&quot;
      </DocLead>

      <ComponentPreview>
        <EmptyState
          icon={<Inbox size={24} color={iconColor} />}
          title="No quotes yet"
          description="Create your first quote to start the enquiry-to-invoice workflow."
          action={
            <Button onPress={() => {}}>Create quote</Button>
          }
        />
      </ComponentPreview>

      <DocSection title="Features">
        <FeatureList
          items={[
            "Centered icon, heading, optional description, and optional primary action.",
            "The action slot accepts any node, typically a Button, so it composes rather than reimplementing button styling.",
            "Unlike web, the icon isn't auto-sized via a descendant CSS selector (RN has none) — pass an already-sized icon element, e.g. <Inbox size={24} />.",
          ]}
        />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { EmptyState } from "@spine/ui-native";

<EmptyState title="No quotes yet" />;`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable
          rows={[
            { prop: "icon", type: "ReactNode" },
            { prop: "title", type: "string" },
            { prop: "description", type: "string" },
            { prop: "action", type: "ReactNode" },
          ]}
        />
      </DocSection>

      <DocSection title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<EmptyState
  icon={<Inbox size={24} />}
  title="No quotes yet"
  description="Create your first quote to start the enquiry-to-invoice workflow."
  action={<Button>Create quote</Button>}
/>`}
        >
          <EmptyState
            icon={<Inbox size={24} color={iconColor} />}
            title="No quotes yet"
            description="Create your first quote to start the enquiry-to-invoice workflow."
            action={<Button onPress={() => {}}>Create quote</Button>}
          />
        </ComponentPreview>

        <DocLead>Minimal (title only)</DocLead>
        <ComponentPreview code={`<EmptyState title="No jobs found" />`}>
          <EmptyState title="No jobs found" />
        </ComponentPreview>
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>The icon is decorative; the heading carries the actual meaning for screen readers.</DocLead>
      </DocSection>
    </DocScreen>
  );
}
