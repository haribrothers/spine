"use client";

import { useState } from "react";
import { Button, RadioGroup, RadioGroupItem, Spinner, cn } from "@spine/ui";
import { CONSTRUCTION_TEMPLATE_NOTE } from "@spine/shared";

export type IndustryTemplate = "construction" | "general_services" | "generic";

const TEMPLATES: { value: IndustryTemplate; title: string; description: string }[] = [
  {
    value: "construction",
    title: "Construction / Contracting",
    // US-ONB-13: choosing it also seeds the site cost accounts and categories.
    description: `Pre-enables milestones and retention on jobs, and job-costing defaults suited to site work. ${CONSTRUCTION_TEMPLATE_NOTE}`,
  },
  {
    value: "general_services",
    title: "General Services",
    description: "Sensible defaults for service-based work — no milestones/retention shown by default.",
  },
  {
    value: "generic",
    title: "Generic",
    description: "A neutral starting point with nothing industry-specific pre-enabled.",
  },
];

export interface IndustryTemplateStepProps {
  initialValue: IndustryTemplate;
  onSave: (value: IndustryTemplate) => Promise<void>;
  onSkip?: () => void;
  /** Rendered on the save button — defaults to the wizard's "Continue"; Settings passes "Save". */
  saveLabel?: string;
}

/**
 * Industry template picker (S-12.3). Per PRD acceptance highlights, this
 * only pre-sets *defaults and visibility* — it must never restrict what a
 * business can later turn on/off, so this step just persists the choice as
 * a setting. The downstream effect (Construction surfacing
 * milestones/retention) is explicitly Phase 3 territory and not built here.
 */
export function IndustryTemplateStep({ initialValue, onSave, onSkip, saveLabel = "Continue" }: IndustryTemplateStepProps) {
  const [value, setValue] = useState<IndustryTemplate>(initialValue);
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    setSaving(true);
    try {
      await onSave(value);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup value={value} onValueChange={(v) => setValue(v as IndustryTemplate)} className="gap-3">
        {TEMPLATES.map((template) => (
          <label
            key={template.value}
            htmlFor={`template-${template.value}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
              value === template.value ? "border-primary bg-primary/5" : "border-border-strong",
            )}
          >
            <RadioGroupItem value={template.value} id={`template-${template.value}`} className="mt-0.5" />
            <div>
              <p className="text-[14px] font-medium text-on-surface">{template.title}</p>
              <p className="text-[13px] text-on-surface-muted">{template.description}</p>
            </div>
          </label>
        ))}
      </RadioGroup>

      <div className="mt-2 flex items-center justify-between gap-2">
        {onSkip && (
          <Button type="button" variant="ghost" onClick={onSkip}>
            Skip to dashboard
          </Button>
        )}
        <Button onClick={handleContinue} disabled={saving} className="ml-auto">
          {saving ? <Spinner size="sm" /> : saveLabel}
        </Button>
      </div>
    </div>
  );
}
