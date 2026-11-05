"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@spine/ui";
import { apiClient } from "../lib/api-client";
import { HELP_BASE, ONLINE_DOCS_URL, helpPathFor, releaseNotesUrl } from "../lib/help-links";
import { useT } from "../lib/i18n";
import { MENU_ICONS } from "../lib/menu-icons";

/** Each item's name, with a quieter line under it. */
function Item({ title, hint }: { title: string; hint: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-[13px] font-medium text-on-surface">{title}</span>
      <span className="text-[12px] text-on-surface-muted">{hint}</span>
    </span>
  );
}

/**
 * US-SITE-11 (D-110) — the Help (?) menu in the sidebar footer: the guide
 * page for the page you're on, the whole guide, what's new in this
 * version, keyboard shortcuts, and the online docs. Everything but the
 * online docs and release notes opens from this server (/help), in a new
 * tab, so it matches this install's version and works without internet.
 */
export function HelpButton({ collapsed, pageName }: { collapsed: boolean; pageName?: string }) {
  const t = useT();
  const pathname = usePathname() ?? "/";
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ version?: string }>("/health")
      .then((res) => setVersion(res.version ?? null))
      .catch(() => setVersion(null));
  }, []);

  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("common.helpButton.label")}
          className={
            collapsed
              ? "flex h-9 w-9 items-center justify-center rounded-sm text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
              : "flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          }
        >
          <HelpCircle size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-72" data-testid="help-menu">
        <DropdownMenuItem onSelect={() => open(helpPathFor(pathname))}>
          <MENU_ICONS.helpForPage aria-hidden />
          <Item title={t("common.helpMenu.forThisPage")} hint={pageName ? t("common.helpMenu.forThisPageHint", { page: pageName }) : t("common.helpMenu.forThisPageHintGeneric")} />
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => open(`${HELP_BASE}guide/`)}>
          <MENU_ICONS.guide aria-hidden />
          <Item title={t("common.helpMenu.guide")} hint={t("common.helpMenu.guideHint")} />
        </DropdownMenuItem>
        {version && (
          <DropdownMenuItem onSelect={() => open(releaseNotesUrl(version))}>
            <MENU_ICONS.whatsNew aria-hidden />
            <Item title={t("common.helpMenu.whatsNew", { version })} hint={t("common.helpMenu.whatsNewHint")} />
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => open(`${HELP_BASE}guide/keyboard-shortcuts/`)}>
          <MENU_ICONS.shortcuts aria-hidden />
          <Item title={t("common.helpMenu.shortcuts")} hint={t("common.helpMenu.shortcutsHint")} />
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => open(ONLINE_DOCS_URL)}>
          <MENU_ICONS.externalLink aria-hidden />
          <Item title={t("common.helpMenu.onlineDocs")} hint={t("common.helpMenu.onlineDocsHint")} />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-[12px] text-on-surface-muted" data-testid="help-menu-footer">
          {version ? t("common.helpMenu.footer", { version }) : t("common.helpMenu.footerGeneric")}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
