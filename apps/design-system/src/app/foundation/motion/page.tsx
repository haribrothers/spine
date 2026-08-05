import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

const durations = [
  { name: "instant", value: "100ms", usage: "hover/focus color shifts" },
  { name: "fast", value: "150ms", usage: "checkbox/switch toggles" },
  { name: "base", value: "180ms", usage: "the default for dialog/popover/toast enter-exit" },
  { name: "slow", value: "260ms", usage: "page-level transitions, used sparingly" },
];

export default function MotionPage() {
  return (
    <div>
      <DocTitle>Motion</DocTitle>
      <DocLead>
        Motion is functional, not decorative — it confirms a state changed, never used to
        delight or draw attention to itself. Standard easing for most transitions; decelerate
        easing for things entering the screen (modals, toasts sliding in); accelerate easing
        for things leaving. <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">prefers-reduced-motion</code>{" "}
        collapses all durations near-zero.
      </DocLead>

      <DocSection id="durations" title="Durations">
        <div className="my-6 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-border bg-surface-sunken">
              <tr>
                <th className="px-4 py-2 font-medium text-on-surface-muted">Token</th>
                <th className="px-4 py-2 font-medium text-on-surface-muted">Value</th>
                <th className="px-4 py-2 font-medium text-on-surface-muted">Usage</th>
              </tr>
            </thead>
            <tbody>
              {durations.map((d, i) => (
                <tr key={d.name} className={i < durations.length - 1 ? "border-b border-border" : undefined}>
                  <td className="px-4 py-2 font-mono text-[12.5px]">{d.name}</td>
                  <td className="px-4 py-2 font-mono text-[12.5px] text-on-surface-muted">{d.value}</td>
                  <td className="px-4 py-2 text-on-surface-muted">{d.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection id="easing" title="Easing">
        <div className="my-4 flex flex-col gap-2 text-[13px] text-on-surface">
          <div className="flex items-center gap-3">
            <code className="w-40 shrink-0 rounded border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-[12.5px]">
              easing-standard
            </code>
            <span className="text-on-surface-muted">cubic-bezier(0.4, 0, 0.2, 1) — most transitions</span>
          </div>
          <div className="flex items-center gap-3">
            <code className="w-40 shrink-0 rounded border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-[12.5px]">
              easing-decelerate
            </code>
            <span className="text-on-surface-muted">cubic-bezier(0, 0, 0.2, 1) — entering the screen</span>
          </div>
          <div className="flex items-center gap-3">
            <code className="w-40 shrink-0 rounded border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-[12.5px]">
              easing-accelerate
            </code>
            <span className="text-on-surface-muted">cubic-bezier(0.4, 0, 1, 1) — leaving the screen</span>
          </div>
        </div>
      </DocSection>

      <DocSection id="reduced-motion" title="Reduced motion">
        <DocLead>
          Some field users are on jarring, low-frame-rate outdoor conditions where motion can
          also be a readability problem, not just an accessibility one — respecting
          `prefers-reduced-motion` matters doubly here, not only for users who've set it as an
          OS preference.
        </DocLead>
      </DocSection>
    </div>
  );
}
