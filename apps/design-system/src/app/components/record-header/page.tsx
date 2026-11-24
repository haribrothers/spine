import { Badge, Button, RecordFigures, RecordHeader } from "@spine/ui";
import { User } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-1 p-4">
      <span className="text-[12.5px] text-on-surface-muted">{label}</span>
      <span className="text-[19px] font-bold tabular-nums">{value}</span>
      <span className="text-[12px] text-on-surface-muted">{note}</span>
    </div>
  );
}

export default function RecordHeaderPage() {
  return (
    <div>
      <DocTitle>RecordHeader</DocTitle>
      <DocLead>The top of a record: its number or name and status, then on a phone its key amount, then the contact, dates and where it came from. RecordFigures holds the figures under it, two per row on a phone (US-OPS-58).</DocLead>

      <ComponentPreview>
        <div className="flex w-full flex-col gap-4">
          <RecordHeader
            title="INV-0038"
            badges={<Badge className="bg-overdue-bg text-overdue">Overdue</Badge>}
            amount={{ label: "Balance due", value: "$13,255.50", note: "Due Oct 4 · 45 days overdue", tone: "overdue" }}
            meta={
              <p className="flex items-center gap-1.5 text-[13px] text-on-surface-muted">
                <User size={14} aria-hidden />
                Sahyadri Retail
              </p>
            }
            actions={
              <div className="flex gap-2 max-md:hidden">
                <Button variant="secondary">Download PDF</Button>
                <Button>Send reminder</Button>
              </div>
            }
          />
          <RecordFigures>
            <Figure label="Total" value="$24,479.10" note="incl. tax $3,734.10" />
            <Figure label="Paid" value="$10,000.00" note="Last paid Nov 3" />
            <Figure label="Balance due" value="$13,255.50" note="45 days overdue" />
          </RecordFigures>
        </div>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "The number is the page's h1; the status is a Badge with its text.",
            "The key amount (balance due while there's one, else the total) shows under the title only on a phone; from 768px up it's in the figures.",
            "No breadcrumb on a phone: the back arrow is in the top bar.",
            "RecordFigures: lines between the figures; in one row from 768px up, two per row on a phone, a last one on its own the full width.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`<RecordHeader title="INV-0038" badges={<Badge>Overdue</Badge>} amount={{ label: "Balance due", value, note, tone: "overdue" }} meta={<p>…</p>} actions={<div className="max-md:hidden">…</div>} />\n<RecordFigures>{figures}</RecordFigures>`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "title", type: "ReactNode — the number or name (the h1)" },
            { prop: "badges", type: "ReactNode — its status Badge and any others" },
            { prop: "subtitle", type: "ReactNode — a line under the title (a job's name)" },
            { prop: "amount", type: "{ label, value, note?, tone?: 'default' | 'overdue' | 'paid' } — on a phone only" },
            { prop: "meta", type: "ReactNode — the contact, dates, where it came from" },
            { prop: "actions", type: "ReactNode — the actions, on the right from 768px up" },
            { prop: "RecordFigures columns", type: "1–5 — figures per row from 768px up (default: all of them)" },
          ]}
        />
      </DocSection>
    </div>
  );
}
