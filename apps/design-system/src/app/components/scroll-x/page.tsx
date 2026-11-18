import { ScrollX } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function ScrollXPage() {
  return (
    <div>
      <DocTitle>ScrollX</DocTitle>
      <DocLead>
        A box whose content can be wider than the screen and scrolls sideways inside it, so the page never does. When it
        actually scrolls it becomes a focusable, named region, so the keyboard can scroll it too.
      </DocLead>

      <ComponentPreview>
        <ScrollX label="Lines, scrolls sideways" className="w-72 rounded-md border border-border">
          <table className="min-w-[560px] text-[13px]">
            <tbody>
              <tr>
                <td className="px-3 py-2">Window installation</td>
                <td className="px-3 py-2 text-right">4</td>
                <td className="px-3 py-2 text-right">$650.00</td>
                <td className="px-3 py-2 text-right">15%</td>
                <td className="px-3 py-2 text-right">$2,990.00</td>
              </tr>
            </tbody>
          </table>
        </ScrollX>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Scrolls sideways inside its own box; the page doesn't (US-OPS-15).",
            "Only when its content is wider than the box does it take tabIndex 0, role region and its label, so a keyboard can scroll it (US-OPS-62, axe scrollable-region-focusable).",
            "When everything fits it adds no tab stop.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { ScrollX } from "@spine/ui";

export default () => <ScrollX label={t("ui.scrollX.label")}><table>…</table></ScrollX>;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "label", type: "string — names the region when it scrolls" },
            { prop: "…", type: "standard <div> attributes on the root" },
          ]}
        />
      </DocSection>
    </div>
  );
}
