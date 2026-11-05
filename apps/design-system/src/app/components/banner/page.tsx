"use client";

import { Banner } from "@spine/ui";
import { HardDrive } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

export default function BannerPage() {
  return (
    <div>
      <DocTitle>Banner</DocTitle>
      <DocLead>
        A full-width notice across the top of the content area, above the page header — for app-wide states an
        Owner should act on, such as an available update or storage running out. Distinct from Alert, which sits
        inside a page, and Toast, which is temporary.
      </DocLead>

      <ComponentPreview>
        <Banner
          className="w-full"
          title="Spine 1.4 is available."
          actions={
            <>
              <a href="#whats-new">What&apos;s new</a>
              <a href="#how-to-update">How to update</a>
            </>
          }
          onDismiss={() => undefined}
        >
          You&apos;re on 1.3. Updating runs database migrations automatically and takes a backup first.
        </Banner>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Three variants: info (an update), warning (act soon, e.g. storage nearly full) and critical (something is broken).",
            "A leading icon per variant so colour is never the only signal — pass icon={null} to opt out, or your own icon.",
            "Optional bold title, actions on the right (links in the primary colour) and a dismiss button with an accessible label.",
            "critical renders role=\"alert\"; info and warning render role=\"status\".",
            "Rendered through AppShellContent's banner slot so it spans the content area above the page header.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { AppShellContent, Banner } from "@spine/ui";

export default () => (
  <AppShellContent banner={<Banner variant="warning">Storage is 91% full.</Banner>}>
    {/* page */}
  </AppShellContent>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "variant", type: "info | warning | critical", defaultValue: "info" },
            { prop: "title", type: "ReactNode", defaultValue: "—" },
            { prop: "icon", type: "ReactNode", defaultValue: "a variant icon; pass null for none" },
            { prop: "actions", type: "ReactNode", defaultValue: "—" },
            { prop: "onDismiss", type: "() => void", defaultValue: "— (no close button)" },
            { prop: "dismissLabel", type: "string", defaultValue: "\"Dismiss\"" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Warning (storage nearly full)</DocLead>
        <ComponentPreview
          code={`<Banner variant="warning" icon={<HardDrive />}>
  Storage is 91% full. Free up space or add disk before uploads stop working.
</Banner>`}
        >
          <Banner variant="warning" icon={<HardDrive />} className="w-full">
            Storage is 91% full. Free up space or add disk before uploads stop working.
          </Banner>
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
