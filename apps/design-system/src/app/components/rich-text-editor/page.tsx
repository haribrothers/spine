"use client";

import { useState } from "react";
import { RichTextContent, RichTextEditor } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

function RichTextEditorDemo() {
  const [value, setValue] = useState("<p>Payment due within <strong>14 days</strong> of invoice date.</p>");
  return <RichTextEditor value={value} onValueChange={setValue} placeholder="Terms & conditions…" />;
}

function RichTextContentDemo() {
  return <RichTextContent html="<p>Payment due within <strong>14 days</strong> of invoice date. See our <a href='#'>full policy</a>.</p>" />;
}

export default function RichTextEditorPage() {
  return (
    <div>
      <DocTitle>RichTextEditor</DocTitle>
      <DocLead>
        Basic rich text — bold, italic, bullet/numbered lists, links. For a quote's notes or terms &
        conditions, where plain text reads flat but a full document editor would be overkill.
      </DocLead>

      <ComponentPreview>
        <RichTextEditorDemo />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Bold, italic, bullet lists, numbered lists, and links — nothing more. Headings, tables, and images are deliberately out of scope.",
            "Built on Tiptap (MIT-licensed) — a schema-constrained editor, not a raw contenteditable, so pasted or typed markup can never escape the allowed set of tags.",
            "Stores and emits plain HTML (not Markdown or a JSON document), matching the plain `text` columns it fills (e.g. a quote's notes/termsAndConditions) and the PDF renderer that lays it out.",
            "RichTextContent, a companion read-only component, renders that stored HTML back out for display — sanitized via DOMPurify at render time, since the source column has no server-side HTML validation and could in principle hold anything.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { RichTextEditor } from "@spine/ui";

export default () => {
  const [value, setValue] = useState("<p>Hello</p>");
  return <RichTextEditor value={value} onValueChange={setValue} placeholder="Notes…" />;
};`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <DocLead>RichTextEditor</DocLead>
        <ApiTable
          rows={[
            { prop: "value", type: "string" },
            { prop: "onValueChange", type: "(html: string) => void" },
            { prop: "placeholder", type: "string" },
            { prop: "disabled", type: "boolean", defaultValue: "false" },
            { prop: "error", type: "boolean", defaultValue: "false" },
            { prop: "id / aria-invalid / aria-required / aria-describedby", type: "passed through to the editable region" },
          ]}
        />
        <DocLead>RichTextContent</DocLead>
        <ApiTable
          rows={[
            { prop: "html", type: "string" },
            { prop: "className", type: "string" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Editor</DocLead>
        <ComponentPreview
          code={`const [value, setValue] = useState("<p>Payment due within <strong>14 days</strong> of invoice date.</p>");

<RichTextEditor value={value} onValueChange={setValue} placeholder="Terms & conditions…" />`}
        >
          <RichTextEditorDemo />
        </ComponentPreview>

        <DocLead>Read-only display (RichTextContent)</DocLead>
        <ComponentPreview
          code={`<RichTextContent html="<p>Payment due within <strong>14 days</strong> of invoice date. See our <a href='#'>full policy</a>.</p>" />`}
        >
          <RichTextContentDemo />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <FeatureList
          items={[
            "Toolbar buttons expose aria-pressed reflecting the active mark/block at the cursor.",
            "Pair with FormField for a proper label — id/aria-invalid/aria-required/aria-describedby all pass through to the editable region the same way Input/Textarea do.",
            "Keyboard: standard contenteditable navigation, plus the browser's own text-editing shortcuts (Ctrl/Cmd+B for bold, Ctrl/Cmd+I for italic) work natively via Tiptap.",
          ]}
        />
      </DocSection>
    </div>
  );
}
