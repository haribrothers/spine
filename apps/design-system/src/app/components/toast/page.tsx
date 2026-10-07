"use client";

import {
  Button,
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@spine/ui";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

function ToastDemo() {
  const [open, setOpen] = useState(false);
  return (
    <ToastProvider>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Send invoice
      </Button>
      <Toast open={open} onOpenChange={setOpen} duration={3000}>
        <div>
          <ToastTitle>Invoice sent</ToastTitle>
          <ToastDescription>INV-2026-0042 was emailed to Acme Contracting Ltd.</ToastDescription>
        </div>
        <ToastClose />
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
}

export default function ToastPage() {
  return (
    <div>
      <DocTitle>Toast</DocTitle>
      <DocLead>
        A succinct message that is displayed temporarily. Dark chrome, bottom-right,
        auto-dismissing — confirms an action succeeded. Never carries a validation error, which
        belongs inline via HelperText.
      </DocLead>

      <ComponentPreview>
        <ToastDemo />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Automatically closes after a set duration.",
            "Swipe to dismiss on touch devices.",
            "Supports an optional action button (ToastAction).",
            "Multiple toasts stack and queue via the shared ToastProvider/ToastViewport.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { ToastProvider, Toast, ToastTitle, ToastDescription, ToastAction, ToastClose, ToastViewport } from "@spine/ui";

export default () => (
  <ToastProvider>
    <Toast>
      <ToastTitle />
      <ToastDescription />
      <ToastAction />
      <ToastClose />
    </Toast>
    <ToastViewport />
  </ToastProvider>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "Toast.open", type: "boolean" },
            { prop: "Toast.onOpenChange", type: "(open: boolean) => void" },
            { prop: "Toast.duration", type: "number", defaultValue: "5000" },
            { prop: "ToastViewport.label", type: "string", defaultValue: '"Notifications"' },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<ToastProvider>
  <Toast open={open} onOpenChange={setOpen} duration={3000}>
    <div>
      <ToastTitle>Invoice sent</ToastTitle>
      <ToastDescription>INV-2026-0042 was emailed to Acme Contracting Ltd.</ToastDescription>
    </div>
    <ToastClose />
  </Toast>
  <ToastViewport />
</ToastProvider>`}
        >
          <ToastDemo />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Announced via an ARIA live region so screen reader users hear the confirmation
          without it stealing focus from their current task.
        </DocLead>
        <KeyboardTable
          rows={[
            { keys: "Esc (focus on the toast)", description: "Closes the toast." },
            {
              keys: "Esc (focus elsewhere)",
              description: "Closes the toast and passes Escape on, so an open dialog or drawer underneath closes with the same press.",
            },
          ]}
        />
      </DocSection>
    </div>
  );
}
