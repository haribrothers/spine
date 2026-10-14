import { SpineLogo } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function SpineLogoPage() {
  return (
    <div>
      <DocTitle>SpineLogo</DocTitle>
      <DocLead>
        The Spine logo — the layered mark and the SPiNE wordmark — drawn from the supplied artwork, the same as the
        phone app. Used in the sidebar, on the sign-in pages and in the public quote footer (US-SET-26).
      </DocLead>

      <ComponentPreview>
        <div className="flex items-center gap-8">
          <SpineLogo variant="horizontal" size={140} />
          <SpineLogo variant="vertical" size={110} />
          <SpineLogo variant="mark" size={40} />
        </div>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Three forms: the mark alone, the horizontal lockup (mark beside the wordmark) and the vertical lockup (mark above it).",
            "The wordmark uses --color-brand-wordmark: Spine blue in light mode, light text in dark. Dark mode is CSS, so it's right from the first frame.",
            "A business's theme (Harbour Teal, Plum, Graphite) never recolours it — Spine's logo stays Spine's.",
            "Never smaller than the brand minimum: 20 px for the mark, 96 px wide for a lockup.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { SpineLogo } from "@spine/ui";

<SpineLogo variant="horizontal" size={140} />;
<SpineLogo decorative size={20} /> Sent with Spine;`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "variant", type: '"mark" | "horizontal" | "vertical"', defaultValue: '"mark"' },
            { prop: "size", type: "number (px: the mark's side, or a lockup's width)", defaultValue: "32 / 140" },
            { prop: "decorative", type: "boolean", defaultValue: "false" },
            { prop: "className", type: "string" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>The sidebar, expanded and collapsed</DocLead>
        <ComponentPreview code={`<SpineLogo variant="horizontal" size={96} />\n<SpineLogo variant="mark" size={28} />`}>
          <div className="flex items-center gap-8">
            <SpineLogo variant="horizontal" size={96} />
            <SpineLogo variant="mark" size={28} />
          </div>
        </ComponentPreview>
        <DocLead>The minimum sizes</DocLead>
        <ComponentPreview code={`<SpineLogo variant="mark" size={20} />\n<SpineLogo variant="horizontal" size={96} />`}>
          <div className="flex items-center gap-8">
            <SpineLogo variant="mark" size={20} />
            <SpineLogo variant="horizontal" size={96} />
          </div>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          The logo is one image named &ldquo;Spine&rdquo;. Pass decorative where the word Spine is already next to it
          (&ldquo;Sent with Spine&rdquo;), so a screen reader doesn&apos;t say it twice.
        </DocLead>
      </DocSection>
    </div>
  );
}
