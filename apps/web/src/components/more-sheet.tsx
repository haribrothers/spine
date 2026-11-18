"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomSheet, Button, Spinner, cn, type AppShellNavSection } from "@spine/ui";
import { CircleHelp } from "lucide-react";
import { AppUserMenu, useSignOut } from "./app-user-menu";
import { useOpenSettings } from "./settings-route";
import { helpPathFor } from "../lib/help-links";
import { MENU_ICONS } from "../lib/menu-icons";
import { useT } from "../lib/i18n";

export interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The sidebar's sections, already filtered to what this person can open. */
  sections: AppShellNavSection[];
  isActive: (href: string) => boolean;
  userName: string;
  userEmail: string;
  isOwner: boolean;
}

/**
 * US-OPS-54 (D-283) — the More tab: the whole menu in a sheet, grouped as the sidebar is,
 * then the person's account, Settings, Help and Sign out. Choosing a page, Close or a swipe
 * down closes it.
 */
export function MoreSheet({ open, onOpenChange, sections, isActive, userName, userEmail, isOwner }: MoreSheetProps) {
  const t = useT();
  const pathname = usePathname() ?? "/";
  const openSettings = useOpenSettings(isOwner);
  const { signOut, signingOut } = useSignOut();

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t("common.phone.more.title")} height="full" data-testid="more-sheet">
      <nav aria-label={t("common.phone.more.pages")}>
        {sections.map((section) => (
          <section key={section.label} aria-label={section.label}>
            <p className="px-1 pb-1 pt-3 text-[12px] font-medium uppercase tracking-[0.04em] text-on-surface-muted">{section.label}</p>
            <ul className="grid grid-cols-2 gap-x-2">
              {section.items.map((item) => {
                const current = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      onClick={() => onOpenChange(false)}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-md px-2 text-[15px] text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0 [&_svg]:text-on-surface-muted",
                        current && "bg-info-bg font-semibold text-primary [&_svg]:text-primary",
                      )}
                    >
                      {item.icon}
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
      <div className="mt-3 border-t border-border pt-2">
        <AppUserMenu name={userName} email={userEmail} collapsed={false} isOwner={isOwner} />
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
              openSettings();
            }}
          >
            <MENU_ICONS.settings aria-hidden />
            {t("common.userMenu.settings")}
          </Button>
          <Button variant="secondary" onClick={() => window.open(helpPathFor(pathname), "_blank", "noopener,noreferrer")}>
            <CircleHelp aria-hidden />
            {t("common.phone.more.help")}
          </Button>
          <Button variant="secondary" disabled={signingOut} onClick={() => void signOut()}>
            {signingOut ? <Spinner size="sm" /> : <MENU_ICONS.signOut aria-hidden />}
            {t("common.userMenu.signOut")}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
