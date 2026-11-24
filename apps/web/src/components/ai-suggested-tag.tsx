import { Sparkles } from "lucide-react";
import { cn } from "@spine/ui";
import { t } from "../lib/i18n";

/** The shared rules (D-242) — "Suggested by AI" on a field or row AI filled, until the person changes it. Words and icon, never colour alone. */
export function AiSuggestedTag({ className, label = t("common.aiSuggested.label") }: { className?: string; /** US-AI-11: "Drafted by AI" on an email AI wrote. */ label?: string }) {
  return (
    <span data-testid="ai-suggested" className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm bg-info-bg px-1.5 py-0.5 text-[11px] font-medium leading-none text-primary", className)}>
      <Sparkles size={11} aria-hidden />
      {label}
    </span>
  );
}

/** A form field with the tag at the end of its label row while `suggested`; `tagClassName` moves it (a wide field's input is narrower). */
export function AiField({ suggested, children, className, tagClassName, label }: { suggested: boolean; children: React.ReactNode; className?: string; tagClassName?: string; label?: string }) {
  return (
    <div className={cn("relative", className)}>
      {suggested && <AiSuggestedTag className={cn("absolute right-0 top-0", tagClassName)} label={label} />}
      {children}
    </div>
  );
}
