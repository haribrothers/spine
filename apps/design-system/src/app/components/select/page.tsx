"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function SelectPage() {
  return (
    <div>
      <DocTitle>Select</DocTitle>
      <DocLead>
        A flat, fixed list of options — a document status, a tax rate. Reach for Combobox
        instead when the list needs search-as-you-type filtering or grouped labels.
      </DocLead>

      <DocSection id="default" title="Default">
        <ComponentPreview
          code={`<Select defaultValue="draft">
  <SelectTrigger className="w-48">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="draft">Draft</SelectItem>
    <SelectItem value="sent">Sent</SelectItem>
    <SelectItem value="paid">Paid</SelectItem>
    <SelectItem value="overdue">Overdue</SelectItem>
  </SelectContent>
</Select>`}
        >
          <Select defaultValue="draft">
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
