import { ActionBar, Button } from "@spine/ui";
import { Bell } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function ActionBarPage() {
  return (
    <div>
      <DocTitle>ActionBar</DocTitle>
      <DocLead>A record&apos;s main action for its state. From 768px up it&apos;s the button where it was; on a phone it&apos;s a full-width button in a bar above the tab bar, and the record&apos;s other actions are under the top bar&apos;s ⋯ (US-OPS-58).</DocLead>

      <ComponentPreview>
        <ActionBar>
          <Button>
            <Bell aria-hidden />
            Send reminder
          </Button>
        </ActionBar>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "One button: Send reminder, Issue invoice, Record payment, Invoice a milestone.",
            "Rendered into the shell's ActionBarSlot, between the page and the tab bar, so it never covers the page's last lines.",
            "Steps aside with the tab bar while a full-screen dialog is open or the keyboard is up.",
            "Resize below 768px to see it at the bottom of the screen.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`// In the shell, above the tab bar:\n<ActionBarSlot />\n\n// On the record:\n<ActionBar><Button onClick={remind}><Bell />Send reminder</Button></ActionBar>`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "children", type: "the record's one main Button" },
            { prop: "className", type: "string — extra classes for the bar on a phone" },
          ]}
        />
      </DocSection>
    </div>
  );
}
