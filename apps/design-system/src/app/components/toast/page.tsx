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
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

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
        Dark chrome, bottom-right, auto-dismissing — confirms an action succeeded. Never
        carries a validation error, which belongs inline via HelperText.
      </DocLead>

      <DocSection id="default" title="Default">
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
    </div>
  );
}
