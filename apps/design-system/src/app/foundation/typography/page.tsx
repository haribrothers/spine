import { Display, H1, H2, H3, Lead, Muted, P } from "@spine/ui";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

const rows = [
  { name: "Display", size: "32px", weight: "650", node: <Display>The quick brown fox</Display> },
  { name: "H1", size: "24px", weight: "650", node: <H1>The quick brown fox</H1> },
  { name: "H2", size: "18px", weight: "600", node: <H2>The quick brown fox</H2> },
  { name: "H3", size: "15px", weight: "600", node: <H3>The quick brown fox</H3> },
  { name: "Lead", size: "15px", weight: "400", node: <Lead>The quick brown fox jumps over the lazy dog.</Lead> },
  { name: "Body (P)", size: "14px", weight: "400", node: <P>The quick brown fox jumps over the lazy dog.</P> },
  { name: "Muted", size: "13px", weight: "400", node: <Muted>The quick brown fox jumps over the lazy dog.</Muted> },
];

export default function TypographyFoundationPage() {
  return (
    <div>
      <DocTitle>Typography</DocTitle>
      <DocLead>
        Inter is the only UI typeface — legible at the small sizes a dense invoice-line table
        or AR aging grid demands, and it's what most of Spine's audience already reads all day
        in their OS and browser chrome. IBM Plex Mono is used narrowly, for exactly the values
        that benefit from fixed-width alignment: money amounts in tables and document numbers
        (INV-2026-0001) — tabular figures are turned on so a changing number never visually
        reflows its neighbors.
      </DocLead>

      <DocSection id="scale" title="Type scale">
        <div className="my-6 divide-y divide-border rounded-lg border border-border">
          {rows.map((row) => (
            <div key={row.name} className="flex items-center gap-6 p-4">
              <div className="w-24 shrink-0 text-[12px] text-on-surface-muted">
                <div className="font-medium text-on-surface">{row.name}</div>
                <div className="font-mono">
                  {row.size} / {row.weight}
                </div>
              </div>
              <div className="min-w-0 flex-1">{row.node}</div>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection id="mono-data" title="Mono data">
        <DocLead>
          IBM Plex Mono, used for money amounts and document numbers everywhere they appear —
          tables, PDFs, the ledger drill-down view.
        </DocLead>
        <div className="my-4 flex flex-col gap-1 rounded-lg border border-border p-4 font-mono text-[13px] text-on-surface">
          <div className="flex justify-between">
            <span>INV-2026-0042</span>
            <span className="tabular-nums">$1,240.00</span>
          </div>
          <div className="flex justify-between">
            <span>INV-2026-0043</span>
            <span className="tabular-nums">$89.50</span>
          </div>
        </div>
      </DocSection>

      <DocSection id="usage" title="Usage">
        <DocLead>
          Use the Typography components (Display, H1, H2, H3, Lead, P, Muted — see the{" "}
          <a href="/components/typography" className="text-primary underline underline-offset-2">
            Typography component page
          </a>
          ) for content-heavy screens like a quote's terms or a help article. Dashboard chrome
          typically composes its own headings inline per component instead — e.g.{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">CardTitle</code>{" "}
          on a Card, or a page's own H1-styled title next to a PageHeader action slot.
        </DocLead>
      </DocSection>
    </div>
  );
}
