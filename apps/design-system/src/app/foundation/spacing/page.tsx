import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

const scale = [
  { name: "xs", value: "4px" },
  { name: "sm", value: "8px" },
  { name: "md", value: "12px" },
  { name: "lg", value: "20px" },
  { name: "xl", value: "32px" },
  { name: "2xl", value: "48px" },
];

export default function SpacingPage() {
  return (
    <div>
      <DocTitle>Spacing</DocTitle>
      <DocLead>
        A 12px spacing scale (with a 4px half-step for icon-to-label gaps) governs all spacing
        in Spine. Related fields are grouped in Cards with 20px internal padding (16px mobile);
        margins are 32px desktop / 16px mobile. A max-width grid (1200px) governs the desktop
        app so a 40-line invoice table doesn't become uncomfortably sparse on an ultra-wide
        monitor.
      </DocLead>

      <DocSection id="scale" title="Scale">
        <div className="my-6 flex flex-col gap-3">
          {scale.map((step) => (
            <div key={step.name} className="flex items-center gap-4">
              <div className="w-16 shrink-0 font-mono text-[12px] text-on-surface-muted">{step.name}</div>
              <div className="w-16 shrink-0 font-mono text-[12px] text-on-surface-muted">{step.value}</div>
              <div className="h-4 rounded-sm bg-primary" style={{ width: step.value }} />
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection id="touch-target" title="Touch target">
        <DocLead>
          Every interactive control in the mobile field-companion app (photo capture, expense
          submission, milestone toggles) uses a minimum 44×44px touch target — a field user is
          frequently one-handed, sometimes gloved, on a job site. Form controls stay
          consistent (40px height) across both desktop and mobile for one shared component set;
          Button's <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">touch</code>{" "}
          size and every touch-surface Checkbox/RadioGroup/Switch already meet this via padding.
        </DocLead>
      </DocSection>
    </div>
  );
}
