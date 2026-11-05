"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@spine/ui";
import { useCapabilities } from "../lib/capabilities-context";
import { pageAccessFor } from "../lib/page-access";
import { useMyRole } from "../lib/role-context";
import { useT } from "../lib/i18n";

const pathOf = (href: ComponentProps<typeof Link>["href"]): string => (typeof href === "string" ? href : (href.pathname ?? "")).split(/[?#]/)[0] ?? "";

/**
 * US-TEAM-31 (D-235) — whether this person can open the page at `href`.
 * While capabilities load it reads as open, so links don't flicker.
 */
export function useCanOpen(): (href: ComponentProps<typeof Link>["href"]) => boolean {
  const role = useMyRole();
  const { capabilities } = useCapabilities();
  return (href) => pageAccessFor(pathOf(href), role, capabilities).state !== "denied";
}

/**
 * A link to a record in another section. When that section is closed for
 * this person, the record's name shows as plain text with a lock, not a link.
 */
export function SectionLink({ href, className, children, "data-testid": testId, ...rest }: ComponentProps<typeof Link> & { "data-testid"?: string }) {
  const t = useT();
  const role = useMyRole();
  const { capabilities } = useCapabilities();
  const access = pageAccessFor(pathOf(href), role, capabilities);
  if (access.state !== "denied") {
    return (
      <Link href={href} className={className} data-testid={testId} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <span className={cn(className, "inline-flex items-center gap-1 text-on-surface hover:no-underline")} data-testid={testId} data-closed-section="">
      {children}
      <Lock size={12} aria-hidden className="shrink-0 text-on-surface-muted" />
      <span className="sr-only">{t("common.sectionLink.closed", { page: access.pageName })}</span>
    </span>
  );
}
