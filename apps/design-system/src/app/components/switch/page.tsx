import { Switch } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function SwitchPage() {
  return (
    <div>
      <DocTitle>Switch</DocTitle>
      <DocLead>An on/off toggle — e.g. dark-mode-equivalent settings, "require approval" flags.</DocLead>

      <DocSection id="default" title="Default">
        <ComponentPreview
          code={`<label className="flex items-center gap-2">
  <Switch defaultChecked />
  <span>Require owner approval above discount threshold</span>
</label>`}
        >
          <label className="flex items-center gap-2">
            <Switch defaultChecked />
            <span className="text-[14px] text-on-surface">
              Require owner approval above discount threshold
            </span>
          </label>
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
