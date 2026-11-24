import { Display, H1, H2, H3, Lead, Muted, P } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function TypographyPage() {
  return (
    <div>
      <DocTitle>Typography</DocTitle>
      <DocLead>
        Heading/prose style presets matching docs/DESIGN.md's type scale — for content-heavy
        screens (a quote's terms, a help article) rather than dashboard chrome, which typically
        composes its own headings inline per component (Card's CardTitle, etc.).
      </DocLead>

      <ComponentPreview>
        <div className="flex flex-col gap-2">
          <Display>Display</Display>
          <H1>Heading 1</H1>
          <H2>Heading 2</H2>
          <H3>Heading 3</H3>
          <Lead>Lead paragraph text, slightly larger and muted.</Lead>
          <P>Regular body text.</P>
          <Muted>Muted caption text.</Muted>
        </div>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList items={["Seven presets — Display, H1, H2, H3, Lead, P, Muted — each a thin wrapper over a semantic HTML element with the matching DESIGN.md type-scale styling."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`import { Display, H1, H2, H3, Lead, P, Muted } from "@spine/ui";

export default () => <H1>Quote terms</H1>;`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "…", type: "standard heading/paragraph attributes on each preset" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Scale</DocLead>
        <ComponentPreview
          code={`<Display>Display</Display>
<H1>Heading 1</H1>
<H2>Heading 2</H2>
<H3>Heading 3</H3>
<Lead>Lead paragraph text, slightly larger and muted.</Lead>
<P>Regular body text.</P>
<Muted>Muted caption text.</Muted>`}
        >
          <div className="flex flex-col gap-2">
            <Display>Display</Display>
            <H1>Heading 1</H1>
            <H2>Heading 2</H2>
            <H3>Heading 3</H3>
            <Lead>Lead paragraph text, slightly larger and muted.</Lead>
            <P>Regular body text.</P>
            <Muted>Muted caption text.</Muted>
          </div>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Display/H1/H2/H3 render real{" "}
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{"<h1>"}</code>–
          <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">{"<h3>"}</code>{" "}
          elements — keep heading levels in document order (don't skip from H1 to H3) so the
          page's outline stays navigable via screen reader heading navigation.
        </DocLead>
      </DocSection>
    </div>
  );
}
