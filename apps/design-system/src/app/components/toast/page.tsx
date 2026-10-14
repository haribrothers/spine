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

const STACK_MESSAGES: [string, string][] = [
  ["Lead deleted", "“Warehouse racking — Phase 2” is gone from the pipeline."],
  ["Receipt sent", "Emailed to accounts@halcyontech.example."],
  ["RCP-0032 recorded", "₹45,000.00 is credit for Halcyon Tech Parks — apply it or refund it."],
  ["INV-0042 issued", "INV-0042 was posted to the books."],
];

/** US-OPS-38 (D-223) — several in a row: newest on top, three at most; a fourth closes the oldest at once. */
function ToastStackDemo() {
  const [shown, setShown] = useState<{ id: number; title: string; description: string }[]>([]);
  const [next, setNext] = useState(0);
  function add() {
    const [title, description] = STACK_MESSAGES[next % STACK_MESSAGES.length]!;
    setShown((current) => [...current, { id: next, title, description }].slice(-3));
    setNext((n) => n + 1);
  }
  return (
    <ToastProvider duration={5000}>
      <Button variant="secondary" onClick={add}>
        Show a toast
      </Button>
      {shown.map((t) => (
        <Toast key={t.id} onOpenChange={(open) => !open && setShown((current) => current.filter((c) => c.id !== t.id))}>
          <div>
            <ToastTitle>{t.title}</ToastTitle>
            <ToastDescription>{t.description}</ToastDescription>
          </div>
          <ToastClose />
        </Toast>
      ))}
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
            "Toasts stack in the viewport newest on top (rendered oldest first, shown in reverse); below the sm breakpoint the stack spans the bottom of the screen.",
            "Slides in from the right — with Reduce Motion, it appears without sliding.",
            "In the web app, use the one ToastHost (useToast()) rather than a provider per page: it caps the stack (3, or 2 on a phone) and keeps a toast across a page change (D-223).",
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

        <DocLead>A stack — newest on top, three at most</DocLead>
        <ComponentPreview
          code={`// apps/web: one host in the app layout, then anywhere —
const toast = useToast();
toast("RCP-0032 recorded", "₹45,000.00 is credit for Halcyon Tech Parks — apply it or refund it.");

<ToastHost max={3} duration={5000}>{children}</ToastHost>`}
        >
          <ToastStackDemo />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Announced via an ARIA live region so screen reader users hear the confirmation
          without it stealing focus from their current task.
        </DocLead>
        <KeyboardTable
          rows={[
            { keys: "F8", description: "Moves focus to the stack; Tab goes newest first. Hovering the stack or focusing a toast pauses every timer." },
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
