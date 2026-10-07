"use client";

import { EmptyState } from "@spine/ui";
import { PowerOff } from "lucide-react";
import { MODULES, moduleOffMessage, type ModuleKey } from "@spine/shared";

/** US-SET-24 — shown instead of a page that belongs to a switched-off module. */
export function ModuleOff({ module }: { module: ModuleKey }) {
  return (
    <EmptyState
      data-testid="module-off"
      className="mx-auto max-w-[480px] py-24"
      icon={<PowerOff />}
      title={`${MODULES[module].label} is switched off`}
      description={moduleOffMessage(module)}
    />
  );
}
