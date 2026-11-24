"use client";

import { useState } from "react";
import { ActionSheet, Button } from "@spine/ui";
import { Ban, Banknote, Bell, Download, Eye } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function ActionSheetPage() {
  const [open, setOpen] = useState(false);
  const none = () => {};
  return (
    <div>
      <DocTitle>ActionSheet</DocTitle>
      <DocLead>A menu on a phone: the record it&apos;s for, each action with its icon, a destructive action in the danger colour and a separate Cancel (D-283).</DocLead>

      <ComponentPreview>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Open row actions
        </Button>
        <ActionSheet
          open={open}
          onOpenChange={setOpen}
          title="INV-0044"
          subtitle="Lakshmi Multispeciality Hospital · ₹3,45,000.00"
          actions={[
            { key: "view", label: "View", icon: <Eye aria-hidden />, onSelect: none },
            { key: "pay", label: "Record payment", icon: <Banknote aria-hidden />, onSelect: none },
            { key: "remind", label: "Send reminder", icon: <Bell aria-hidden />, onSelect: none },
            { key: "pdf", label: "Download PDF", icon: <Download aria-hidden />, onSelect: none },
            { key: "void", label: "Void…", icon: <Ban aria-hidden />, onSelect: none, destructive: true },
          ]}
        />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Choosing an action closes the sheet, then runs it, so a confirmation opens over the page (D-218).",
            "Icons come from lib/menu-icons.ts (D-222).",
            "Focus stays inside; Escape, Cancel or the dimmed page closes it.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`<ActionSheet open={open} onOpenChange={setOpen} title="INV-0044" actions={[…]} />`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "open · onOpenChange", type: "boolean · (open) => void" },
            { prop: "title · subtitle", type: "string" },
            { prop: "actions", type: "{ key, label, icon, onSelect, destructive, disabled }[]" },
          ]}
        />
      </DocSection>
    </div>
  );
}
