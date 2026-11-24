"use client";

import { EmptyState } from "@spine/ui";
import { PowerOff } from "lucide-react";
import { MODULES, moduleOffMessage, type ModuleKey } from "@spine/shared";
import { useT } from "../lib/i18n";

/** US-SET-24 — shown instead of a page that belongs to a switched-off module. */
export function ModuleOff({ module }: { module: ModuleKey }) {
  const t = useT();
  return (
    <EmptyState
      data-testid="module-off"
      className="mx-auto max-w-[480px] py-24"
      icon={<PowerOff />}
      title={t("common.moduleOff.title", { module: MODULES[module].label })}
      description={moduleOffMessage(module)}
    />
  );
}
