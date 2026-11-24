import {
  Camera,
  Check,
  ChevronDown,
  FileText,
  LayoutDashboard,
  Receipt,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

const icons = [
  { Icon: LayoutDashboard, name: "LayoutDashboard" },
  { Icon: FileText, name: "FileText" },
  { Icon: Receipt, name: "Receipt" },
  { Icon: Users, name: "Users" },
  { Icon: Search, name: "Search" },
  { Icon: Settings, name: "Settings" },
  { Icon: Check, name: "Check" },
  { Icon: ChevronDown, name: "ChevronDown" },
  { Icon: Camera, name: "Camera" },
];

export default function IconsPage() {
  return (
    <div>
      <DocTitle>Icons</DocTitle>
      <DocLead>
        Lucide (<code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">lucide-react</code> on
        web, shared via a NativeWind token layer on mobile per PRD §5) is the single icon set
        everywhere. Icons inherit <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">currentColor</code>{" "}
        — never a hardcoded icon color separate from the surrounding text.
      </DocLead>

      <DocSection id="sizes" title="Sizes">
        <DocLead>Four sizes cover every use case.</DocLead>
        <div className="my-4 flex items-end gap-6">
          {[
            { size: 16, label: "16px — inline/table-row icons" },
            { size: 18, label: "18px — nav items, form field icons (default)" },
            { size: 20, label: "20px — buttons, standalone actions" },
            { size: 24, label: "24px — empty-state icons" },
          ].map((entry) => (
            <div key={entry.size} className="flex flex-col items-center gap-2">
              <Settings size={entry.size} strokeWidth={1.75} className="text-on-surface" />
              <span className="max-w-20 text-center text-[11px] text-on-surface-muted">{entry.label}</span>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection id="stroke-width" title="Stroke width">
        <DocLead>
          Default stroke width is 1.75 — very slightly lighter than Lucide's 2px default, for a
          cleaner read at the small sizes nav items and table-row actions use.
        </DocLead>
      </DocSection>

      <DocSection id="common-icons" title="Common icons">
        <div className="my-4 grid grid-cols-3 gap-4 sm:grid-cols-4">
          {icons.map(({ Icon, name }) => (
            <div key={name} className="flex flex-col items-center gap-2 rounded-md border border-border p-3">
              <Icon size={20} strokeWidth={1.75} className="text-on-surface" />
              <span className="text-[11px] text-on-surface-muted">{name}</span>
            </div>
          ))}
        </div>
      </DocSection>
    </div>
  );
}
