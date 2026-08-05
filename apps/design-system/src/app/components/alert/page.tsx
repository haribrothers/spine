import { Alert, AlertDescription, AlertTitle } from "@spine/ui";
import { AlertTriangle } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function AlertPage() {
  return (
    <div>
      <DocTitle>Alert</DocTitle>
      <DocLead>
        Displays a callout for user attention. A persistent, page-level, non-dismissible-by-
        default inline message (e.g. "This entity has 3 lapsed certifications requiring
        action") — distinct from Toast (temporary/dismissible) and StatusChip (per-row status).
      </DocLead>

      <ComponentPreview>
        <Alert variant="warning" icon={<AlertTriangle />} className="w-96">
          <AlertTitle>3 invoices overdue</AlertTitle>
          <AlertDescription>Follow up with these contacts before month end.</AlertDescription>
        </Alert>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Four variants sharing the same background/text pairs as StatusChip's palette, plus info: info, warning, critical, success.",
            "An optional leading icon, never the sole carrier of meaning.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Alert, AlertTitle, AlertDescription } from "@spine/ui";

export default () => (
  <Alert variant="warning">
    <AlertTitle />
    <AlertDescription />
  </Alert>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "variant", type: "info | warning | critical | success", defaultValue: "info" },
            { prop: "icon", type: "ReactNode" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Alert variant="warning" icon={<AlertTriangle />}>
  <AlertTitle>3 invoices overdue</AlertTitle>
  <AlertDescription>Follow up with these contacts before month end.</AlertDescription>
</Alert>`}
        >
          <Alert variant="warning" icon={<AlertTriangle />} className="w-96">
            <AlertTitle>3 invoices overdue</AlertTitle>
            <AlertDescription>Follow up with these contacts before month end.</AlertDescription>
          </Alert>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Use <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">role=&quot;alert&quot;</code> on the
          root only for genuinely urgent, unsolicited messages that should interrupt a screen
          reader user — most Alerts here are page-level context, not urgent interruptions.
        </DocLead>
      </DocSection>
    </div>
  );
}
