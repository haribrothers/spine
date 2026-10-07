"use client";

import { useState } from "react";
import { Button, DatePicker, ReportFilter, ReportFilterCheckbox, ReportToolbar, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@spine/ui";
import { Download } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

function Example({ loading = false }: { loading?: boolean }) {
  const [from, setFrom] = useState(new Date(2026, 6, 1));
  const [to, setTo] = useState(new Date(2026, 8, 30));
  const [hide, setHide] = useState(true);
  return (
    <ReportToolbar
      loading={loading}
      className="w-full"
      filters={
        <>
          <ReportFilter label="From">
            <DatePicker value={from} onChange={setFrom} />
          </ReportFilter>
          <ReportFilter label="To">
            <DatePicker value={to} onChange={setTo} />
          </ReportFilter>
          <ReportFilter label="Compare with">
            {(id) => (
              <Select defaultValue="none">
                <SelectTrigger className="w-56" aria-labelledby={id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No comparison</SelectItem>
                  <SelectItem value="previous">Previous period</SelectItem>
                </SelectContent>
              </Select>
            )}
          </ReportFilter>
          <ReportFilterCheckbox label="Hide accounts with no balance" checked={hide} onCheckedChange={setHide} />
        </>
      }
      actions={
        <>
          <Button variant="secondary">
            <Download size={14} aria-hidden="true" />
            Export
          </Button>
          <Button>Record tax payment</Button>
        </>
      }
    />
  );
}

export default function ReportToolbarPage() {
  return (
    <div>
      <DocTitle>ReportToolbar</DocTitle>
      <DocLead>
        The bar above every report: labelled 40px filters on the left (From, To, Compare with, Basis, then the report&apos;s own), the page&apos;s actions on the
        right — Export, then the one primary button last — all aligned to the bottom edge of the controls. Filters apply as they change, so there&apos;s no Refresh
        button.
      </DocLead>

      <ComponentPreview>
        <Example />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "ReportFilter puts a label over any 40px control; pass a function child to get the label's id for aria-labelledby (Select, MultiSelect).",
            "ReportFilterCheckbox is a yes/no option the same 40px tall, so it lines up with the controls.",
            "loading shows a spinner after the filters while the report reloads; the figures on screen stay until the new ones arrive.",
            "Wraps on narrow screens; the actions keep to the right.",
            "Hidden when the page prints.",
          ]}
        />
      </DocSection>

      <DocSection id="loading" title="Loading">
        <ComponentPreview>
          <Example loading />
        </ComponentPreview>
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { ReportFilter, ReportFilterCheckbox, ReportToolbar } from "@spine/ui";

<ReportToolbar
  loading={loading}
  filters={
    <>
      <ReportFilter label="From"><DatePicker value={from} onChange={setFrom} /></ReportFilter>
      <ReportFilter label="Compare with">{(id) => <Select …><SelectTrigger aria-labelledby={id}>…</SelectTrigger></Select>}</ReportFilter>
      <ReportFilterCheckbox label="Hide accounts with no balance" checked={hide} onCheckedChange={setHide} />
    </>
  }
  actions={<ReportExportMenu path={url} />}
/>`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "filters", type: "ReactNode", description: "ReportFilter and ReportFilterCheckbox elements, left to right." },
            { prop: "actions", type: "ReactNode", description: "Export, then the one primary button." },
            { prop: "loading", type: "boolean", defaultValue: "false", description: "Shows “Updating the report” as a spinner." },
          ]}
          caption="ReportToolbar"
        />
        <ApiTable
          rows={[
            { prop: "label", type: "string" },
            { prop: "children", type: "ReactNode | (labelId: string) => ReactNode" },
          ]}
          caption="ReportFilter"
        />
        <ApiTable
          rows={[
            { prop: "label", type: "string" },
            { prop: "checked", type: "boolean" },
            { prop: "onCheckedChange", type: "(checked: boolean) => void" },
          ]}
          caption="ReportFilterCheckbox"
        />
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Every control has a visible label tied to it; the loading spinner is a polite status (&quot;Updating the report&quot;), so screen-reader users hear
          the report change without focus moving.
        </DocLead>
      </DocSection>
    </div>
  );
}
