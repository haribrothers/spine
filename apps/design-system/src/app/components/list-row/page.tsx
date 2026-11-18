import { Badge, ListRow, ListRowSkeleton } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function ListRowPage() {
  return (
    <div>
      <DocTitle>ListRow</DocTitle>
      <DocLead>One record as a two-line row on a phone: title and status, a subtitle, the amount on the right and its ⋯ (US-OPS-56, D-283). What Table and DataTable rows become under 768px.</DocLead>

      <ComponentPreview>
        <ul className="w-[390px] max-w-full overflow-hidden rounded-lg border border-border bg-surface">
          <ListRow title={<a href="#inv-0044">INV-0044</a>} badge={<Badge className="bg-overdue-bg text-overdue">Overdue</Badge>} subtitle="Lakshmi Multispeciality Hospital" trailing="₹3,45,000.00" trailingSub="6 days late" />
          <ListRow title={<a href="#inv-0043">INV-0043</a>} badge={<Badge className="bg-paid-bg text-paid">Paid</Badge>} subtitle="Ananya Rao · Kitchen tiling" trailing="₹1,12,100.00" trailingSub="Paid 12 Nov" />
          <ListRowSkeleton />
        </ul>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "A link in the title covers the whole row, so tapping anywhere opens the record.",
            "The ⋯ (an action sheet) and any button sit above it as their own 44px targets.",
            "Long titles and subtitles truncate; the amount never does.",
            "ListRowSkeleton is a placeholder row of the same height.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`<ul><ListRow title={<Link href="…">INV-0044</Link>} badge={…} subtitle="…" trailing="₹3,45,000.00" action={…} /></ul>`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "title", type: "ReactNode — a link in it covers the row" },
            { prop: "badge · subtitle · trailing · trailingSub", type: "ReactNode" },
            { prop: "leading · action", type: "ReactNode" },
            { prop: "selected", type: "boolean" },
          ]}
        />
      </DocSection>
    </div>
  );
}
